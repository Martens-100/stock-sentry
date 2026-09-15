'use strict';
/**
 * 服务端防护层（仅服务端使用，不参与静态打包）。
 *
 * 要防的三件事：
 *   1. 任意网页跨域读你的本地 API —— 去掉 ACAO:*，改为同源 + 显式白名单；
 *   2. DNS Rebinding —— 网页把 evil.com 解析到 127.0.0.1 后直连本地服务。靠 Host 头校验拦截；
 *   3. 把服务端当免费行情代理刷 —— 分接口限流 + 并发上限。
 *
 * 另外统一做错误脱敏：对外只给"内部错误 + 事件号"，细节只进服务端日志。
 */
const cfg = require('./config');

/* ------------------------------------------------------------------ */
/* 1. 限流（滑动窗口 + 每 IP 并发上限）                                 */
/* ------------------------------------------------------------------ */
const RATE_DEFAULT = cfg.num('RATE_LIMIT_PER_MIN', 120);
const RATE_EXPENSIVE = cfg.num('RATE_LIMIT_EXPENSIVE_PER_MIN', 30);
const MAX_CONCURRENT_SSE = cfg.num('MAX_SSE_PER_IP', 4);

/** 命中一次即需要向多家上游发起请求的接口 */
const EXPENSIVE = new Set(['/api/analyze', '/api/scan', '/api/report']);

const windows = new Map();   // `${ip}#${limit}` -> { hits: number[] }
const sseCount = new Map();  // ip -> number

/** 桶必须按「IP + 限额档」隔离：否则普通接口的计数会挤占分析接口的额度 */
function bucketFor(ip, limit) {
  const key = `${ip}#${limit}`;
  let b = windows.get(key);
  if (!b) { b = { hits: [] }; windows.set(key, b); }
  return b;
}

/** 返回 { ok, limit, remaining, retryAfterSec } */
function rateLimit(ip, pathname, now = Date.now()) {
  const limit = EXPENSIVE.has(pathname) ? RATE_EXPENSIVE : RATE_DEFAULT;
  const b = bucketFor(ip, limit);
  b.hits = b.hits.filter((t) => now - t < 60000);
  if (b.hits.length >= limit) {
    const oldest = b.hits[0];
    return { ok: false, limit, remaining: 0, retryAfterSec: Math.max(1, Math.ceil((60000 - (now - oldest)) / 1000)) };
  }
  b.hits.push(now);
  return { ok: true, limit, remaining: limit - b.hits.length, retryAfterSec: 0 };
}

/** 定期清理空桶，避免 Map 无限增长 */
function sweep(now = Date.now()) {
  for (const [key, b] of windows) {
    b.hits = b.hits.filter((t) => now - t < 60000);
    if (!b.hits.length) windows.delete(key);
  }
  for (const [ip, n] of sseCount) if (n <= 0) sseCount.delete(ip);
}
setInterval(sweep, 120000).unref();

function acquireSse(ip) {
  const n = sseCount.get(ip) || 0;
  if (n >= MAX_CONCURRENT_SSE) return false;
  sseCount.set(ip, n + 1);
  return true;
}
function releaseSse(ip) {
  const n = sseCount.get(ip) || 0;
  sseCount.set(ip, Math.max(0, n - 1));
}

/* ------------------------------------------------------------------ */
/* 2. 跨域：同源 + 白名单，绝不再返回 *                                 */
/* ------------------------------------------------------------------ */
const ALLOWED_ORIGINS = cfg
  .option('ALLOWED_ORIGINS', '')
  .split(',')
  .map((s) => s.trim().replace(/\/$/, ''))
  .filter(Boolean);

/**
 * 判断该请求的 Origin 是否可信。
 * 同源（Origin 与 Host 一致）放行；在 ALLOWED_ORIGINS 里的放行；其余拒绝。
 * 浏览器发起的跨域请求一定带 Origin，所以"没有 Origin"通常意味着同源 GET 或非浏览器客户端。
 */
function originDecision(origin, host) {
  if (!origin) return { allowed: true, echo: null };
  const self = [`http://${host}`, `https://${host}`];
  if (self.includes(origin.replace(/\/$/, ''))) return { allowed: true, echo: origin };
  if (ALLOWED_ORIGINS.includes(origin.replace(/\/$/, ''))) return { allowed: true, echo: origin };
  return { allowed: false, echo: null };
}

/* ------------------------------------------------------------------ */
/* 3. Host 头校验：拦截 DNS Rebinding                                   */
/* ------------------------------------------------------------------ */
const TRUSTED_HOSTS = cfg
  .option('TRUSTED_HOSTS', '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function isIpLiteral(hostname) {
  if (IPV4.test(hostname)) return hostname.split('.').every((n) => Number(n) >= 0 && Number(n) <= 255);
  return hostname.includes(':'); // IPv6 字面量
}

/**
 * 只有域名形式的 Host 才可能被 DNS Rebinding 利用（把域名解析到 127.0.0.1）。
 * IP 字面量无法被重绑定，所以一律放行 —— 这样局域网用 192.168.x.x:8848 访问不受影响。
 */
function hostAllowed(hostHeader) {
  if (!hostHeader) return false;
  const hostname = hostHeader.replace(/:\d+$/, '').replace(/^\[|\]$/g, '').toLowerCase();
  if (isIpLiteral(hostname)) return true;
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) return true;
  if (TRUSTED_HOSTS.includes(hostname)) return true;
  return false;
}

/* ------------------------------------------------------------------ */
/* 4. 响应头与错误脱敏                                                  */
/* ------------------------------------------------------------------ */
/** 基础安全头。CSP 对静态页面收得很紧，接口响应不需要 CSP。 */
function securityHeaders(extra = {}) {
  return {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Cross-Origin-Resource-Policy': 'same-origin',
    ...extra
  };
}

const HTML_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self' https://qt.gtimg.cn https://web.ifzq.gtimg.cn https://proxy.finance.qq.com https://smartbox.gtimg.cn https://push2.eastmoney.com",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'none'"
].join('; ');

let incidentSeq = 0;
function newIncident() {
  incidentSeq = (incidentSeq + 1) % 100000;
  return `${Date.now().toString(36)}-${incidentSeq.toString(36)}`;
}

/**
 * 对外错误对象：只给通用文案 + 事件号，绝不回显 err.message（可能含路径、URL、上游响应）。
 * 细节完整写入服务端日志，便于排查。
 */
function publicError(label, err, incident) {
  console.error(`[${incident}] ${label}:`, err && err.stack ? err.stack : err);
  return { ok: false, error: '服务内部错误，请稍后重试', incident };
}

module.exports = {
  rateLimit, acquireSse, releaseSse, sweep, EXPENSIVE,
  originDecision, ALLOWED_ORIGINS,
  hostAllowed, isIpLiteral, TRUSTED_HOSTS,
  securityHeaders, HTML_CSP, newIncident, publicError,
  RATE_DEFAULT, RATE_EXPENSIVE, MAX_CONCURRENT_SSE
};
