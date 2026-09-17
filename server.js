'use strict';
/**
 * StockSentry 服务端（零依赖）
 * 静态托管 + REST API + SSE 实时推送
 *
 * 安全基线（详见 lib/guard.js）：
 *   · Host 头校验 —— 拦截 DNS Rebinding，防止网页借你的浏览器直连本机服务
 *   · 跨域默认拒绝 —— 不再返回 Access-Control-Allow-Origin: *，改为同源 + ALLOWED_ORIGINS 白名单
 *   · 分接口限流 + SSE 并发上限 —— 防止被当作免费行情代理刷
 *   · 错误脱敏 —— 对外只给事件号，细节只进服务端日志
 *   · 严格 CSP 与安全响应头
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const cfg = require('./lib/config');
const guard = require('./lib/guard');
const src = require('./lib/source');
const engine = require('./lib/engine');
const report = require('./lib/report');

const PORT = cfg.num('PORT', 8848);
const HOST = cfg.option('HOST', '0.0.0.0');
const TRUST_PROXY = cfg.flag('TRUST_PROXY', false);
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const OUT = path.join(ROOT, 'out');
const WATCHLIST_FILE = path.join(ROOT, 'data', 'watchlist.json');

const MAX_BODY = 32 * 1024;      // 请求体上限
const MAX_CODES = 50;            // 单次批量分析的标的上限

const START_TS = Date.now();     // 进程启动时刻，供 /api/health 计算 uptime
const APP_VERSION = (() => { try { return require('./package.json').version; } catch (_) { return 'unknown'; } })();

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

/* ------------------------- 自选股持久化 ------------------------- */
function readWatchlist() {
  try {
    const w = JSON.parse(fs.readFileSync(WATCHLIST_FILE, 'utf8'));
    if (w && Array.isArray(w.codes)) return { codes: w.codes, refreshSec: w.refreshSec || 8 };
  } catch (_) { /* 首次运行或文件损坏 */ }
  return { codes: ['000063', '002422', '000032'], refreshSec: 8 };
}
function writeWatchlist(w) {
  fs.writeFileSync(WATCHLIST_FILE, JSON.stringify(w, null, 2));
}

/* ------------------------- 请求工具 ------------------------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon'
};

/** IP 归属：默认只认 socket，避免被伪造的 X-Forwarded-For 绕过限流；反代场景显式开 TRUST_PROXY */
function clientIp(req) {
  if (TRUST_PROXY) {
    const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (xff) return xff;
  }
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

/** 统一出口：安全头 + 同源/白名单 CORS（绝不发 *） */
function reply(req, res, code, body, type = 'application/json; charset=utf-8', extra = {}) {
  const headers = guard.securityHeaders({
    'Content-Type': type,
    'Cache-Control': 'no-store',
    ...extra
  });
  const dec = guard.originDecision(req.headers.origin, req.headers.host);
  if (dec.echo) {
    headers['Access-Control-Allow-Origin'] = dec.echo;
    headers['Vary'] = 'Origin';
  }
  res.writeHead(code, headers);
  res.end(body);
}
const replyJson = (req, res, obj, code = 200) => reply(req, res, code, JSON.stringify(obj));

/** 读取并限制请求体大小 */
function readBody(req, limit = MAX_BODY) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        req.destroy();
        reject(Object.assign(new Error('请求体过大'), { status: 413 }));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** 校验并规范化股票代码；非法返回 null */
function validCode(raw) {
  const n = src.normalize(String(raw || '').trim());
  return n.market ? n.code : null;
}

function parseCodes(raw, fallback) {
  const list = String(raw || fallback || '').split(',').map(validCode).filter(Boolean);
  return [...new Set(list)].slice(0, MAX_CODES);
}

function serveStatic(req, res, pathname) {
  let p = pathname === '/' ? '/index.html' : pathname;
  let decoded;
  try { decoded = decodeURIComponent(p); } catch (_) {
    return reply(req, res, 400, 'Bad Request', 'text/plain; charset=utf-8');
  }
  // 去掉开头的斜杠与任意数量的 ../ ，再 resolve 后做前缀校验（双保险）
  const rel = path.normalize(decoded).replace(/^([/\\]|\.\.([/\\]|$))+/, '');
  const file = path.resolve(PUBLIC, rel);
  if (file !== PUBLIC && !file.startsWith(PUBLIC + path.sep)) {
    return reply(req, res, 403, 'Forbidden', 'text/plain; charset=utf-8');
  }
  if (path.basename(file).startsWith('.')) {   // 挡住 .env / .git 之类
    return reply(req, res, 403, 'Forbidden', 'text/plain; charset=utf-8');
  }
  let st;
  try { st = fs.statSync(file); } catch (_) { st = null; }
  if (!st || st.isDirectory()) {
    return reply(req, res, 404, 'Not Found', 'text/plain; charset=utf-8');
  }
  const ext = path.extname(file).toLowerCase();
  const extra = ext === '.html' ? { 'Content-Security-Policy': guard.HTML_CSP } : {};
  return reply(req, res, 200, fs.readFileSync(file), MIME[ext] || 'application/octet-stream', extra);
}

/* ------------------------- 路由 ------------------------- */
const server = http.createServer(async (req, res) => {
  const incident = guard.newIncident();

  /* --- 0. Host 校验：拦截 DNS Rebinding --- */
  if (!guard.hostAllowed(req.headers.host)) {
    return replyJson(req, res, {
      ok: false, error: 'Host 未授权',
      hint: '若通过自定义域名访问，请设置环境变量 TRUSTED_HOSTS=<你的域名>'
    }, 403);
  }

  /* --- 0b. 跨域校验：默认拒绝 --- */
  const originDec = guard.originDecision(req.headers.origin, req.headers.host);
  if (!originDec.allowed) {
    return replyJson(req, res, {
      ok: false, error: '跨域请求被拒绝',
      hint: '如确需跨域访问，请设置环境变量 ALLOWED_ORIGINS=<允许的来源，逗号分隔>'
    }, 403);
  }

  // 预检请求：到这里说明 Origin 已通过校验
  if (req.method === 'OPTIONS') {
    return reply(req, res, 204, '', 'text/plain; charset=utf-8', {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '600'
    });
  }

  const parsed = url.parse(req.url, true);
  const p = parsed.pathname;
  const q = parsed.query;
  const ip = clientIp(req);

  /* --- 1. 限流：只作用于 API --- */
  if (p.startsWith('/api/')) {
    const rl = guard.rateLimit(ip, p);
    if (!rl.ok) {
      return replyJson(req, res, {
        ok: false, error: '请求过于频繁，请稍后重试', retryAfter: rl.retryAfterSec
      }, 429);
    }
    res.setHeader('X-RateLimit-Limit', String(rl.limit));
    res.setHeader('X-RateLimit-Remaining', String(rl.remaining));
  }

  try {
    /* --- 健康检查：供守护进程 / 监控脚本探活 --- */
    if (p === '/api/health') {
      return replyJson(req, res, {
        ok: true, service: 'stocksentry',
        version: APP_VERSION,
        uptime: Math.round((Date.now() - START_TS) / 1000),
        ts: Date.now(), pid: process.pid
      });
    }

    /* --- 自选股 --- */
    if (p === '/api/watchlist' && req.method === 'GET') {
      const w = readWatchlist();
      const quotes = await src.getQuotes(w.codes).catch(() => ({}));
      const list = w.codes.map((c) => {
        const code = src.normalize(c).code;
        const quote = quotes[code] || null;
        const pf = engine.getProfile(code);
        return { code, name: (quote && quote.name) || (pf && pf.name) || code, hasProfile: !!pf, quote };
      });
      return replyJson(req, res, { ...w, list });
    }

    if (p === '/api/watchlist' && req.method === 'POST') {
      let payload;
      try {
        payload = JSON.parse((await readBody(req)) || '{}');
      } catch (e) {
        return replyJson(req, res, { ok: false, error: e.status === 413 ? '请求体过大' : '请求体不是合法 JSON' }, e.status || 400);
      }
      const w = readWatchlist();
      if (payload.add) {
        const code = validCode(payload.add);
        if (!code) return replyJson(req, res, { ok: false, error: '股票代码格式不正确' }, 400);
        if (!w.codes.includes(code) && w.codes.length < MAX_CODES) w.codes.push(code);
      }
      if (payload.remove) {
        const code = validCode(payload.remove);
        w.codes = w.codes.filter((c) => c !== code);
      }
      if (Array.isArray(payload.codes)) w.codes = parseCodes(payload.codes.join(','));
      if (!w.codes.length) w.codes = ['000063', '002422', '000032'];
      writeWatchlist(w);
      return replyJson(req, res, { ok: true, ...w });
    }

    /* --- 搜索 --- */
    if (p === '/api/search') {
      const kw = String(q.q || '').trim().slice(0, 32);
      const rows = kw ? await src.searchStocks(kw) : [];
      return replyJson(req, res, { ok: true, rows });
    }

    /* --- 完整分析 --- */
    if (p === '/api/analyze') {
      const code = validCode(q.code);
      if (!code) return replyJson(req, res, { ok: false, error: '缺少或非法的 code 参数' }, 400);
      const data = await engine.analyze(code);
      return replyJson(req, res, { ok: true, data });
    }

    /* --- 批量分析（自选股盯盘） --- */
    if (p === '/api/scan') {
      const codes = parseCodes(q.codes, readWatchlist().codes.join(','));
      if (!codes.length) return replyJson(req, res, { ok: false, error: '没有可分析的标的' }, 400);
      const results = await Promise.all(codes.map(async (c) => {
        try { return await engine.analyze(c); }
        catch (_) { return { code: c, error: true }; }   // 不外泄上游错误细节
      }));
      return replyJson(req, res, { ok: true, data: results, ts: Date.now() });
    }

    /* --- 报告生成 --- */
    if (p === '/api/report') {
      const code = validCode(q.code);
      if (!code) return replyJson(req, res, { ok: false, error: '缺少或非法的 code 参数' }, 400);
      const data = await engine.analyze(code);
      const md = report.buildReport(data);
      const bodyHtml = report.mdToHtml(md);
      const html = report.standaloneHtml(`${data.name}（${data.code}）投研报告与持仓攻略`, bodyHtml);

      // 落盘只是副产物，失败不影响接口（云端只读文件系统属正常）
      const saved = [];
      try {
        const stamp = new Date().toISOString().slice(0, 10);
        const base = path.join(OUT, `${data.code}_${data.name}_投研持仓攻略_${stamp}`);
        fs.writeFileSync(base + '.md', md, 'utf8');
        fs.writeFileSync(base + '.html', html, 'utf8');
        saved.push(path.basename(base + '.html'), path.basename(base + '.md'));
      } catch (e) {
        console.warn(`[${incident}] 报告落盘失败（只读文件系统属正常）:`, e.message);
      }

      if (q.format === 'html') {
        const headers = { 'Content-Security-Policy': guard.HTML_CSP };
        if (q.download) {
          headers['Content-Disposition'] =
            `attachment; filename="${encodeURIComponent(`${data.code}_${data.name}_投研持仓攻略.html`)}"`;
        }
        return reply(req, res, 200, html, 'text/html; charset=utf-8', headers);
      }
      return replyJson(req, res, {
        ok: true, code: data.code, name: data.name, md, bodyHtml, files: saved
      });
    }

    /* --- SSE 实时推送 --- */
    if (p === '/api/stream') {
      if (!guard.acquireSse(ip)) {
        return replyJson(req, res, { ok: false, error: '并发连接数过多，请关闭多余窗口后重试' }, 429);
      }
      const codes = parseCodes(q.codes, readWatchlist().codes.join(','));
      res.writeHead(200, guard.securityHeaders({
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive'
      }));
      if (originDec.echo) res.setHeader('Access-Control-Allow-Origin', originDec.echo);

      let alive = true;
      const stop = () => {
        if (!alive) return;
        alive = false;
        guard.releaseSse(ip);
      };
      req.on('close', stop);

      const tick = async () => {
        if (!alive) return;
        try {
          const quotes = await src.getQuotes(codes);
          const rows = codes.map((c) => {
            const code = src.normalize(c).code;
            const qt = quotes[code];
            return qt ? {
              code, name: qt.name, price: qt.price,
              changePct: qt.changePct != null ? +qt.changePct.toFixed(2) : null,
              turnover: qt.turnover, volumeRatio: qt.volumeRatio, amount: qt.amount,
              high: qt.high, low: qt.low, open: qt.open, preClose: qt.preClose, time: qt.time
            } : { code, error: true };
          });
          res.write(`data: ${JSON.stringify({ ts: Date.now(), rows })}\n\n`);
        } catch (_) {
          res.write(`data: ${JSON.stringify({ ts: Date.now(), error: true })}\n\n`);
        }
      };
      await tick();
      const timer = setInterval(tick, 6000);
      req.on('close', () => clearInterval(timer));
      return;
    }

    /* --- 静态资源 --- */
    if (!['GET', 'HEAD'].includes(req.method)) {
      return reply(req, res, 405, 'Method Not Allowed', 'text/plain; charset=utf-8', { Allow: 'GET, HEAD, OPTIONS' });
    }
    return serveStatic(req, res, p);
  } catch (err) {
    // 对外绝不回显 err.message：可能包含上游 URL、文件路径等内部信息
    if (!res.headersSent) return replyJson(req, res, guard.publicError(`${req.method} ${p}`, err, incident), 500);
    console.error(`[${incident}] 响应已发出，无法改写错误响应:`, err && err.message);
  }
});

/* ------------------------- 启动 ------------------------- */
server.listen(PORT, HOST, () => {
  const w = readWatchlist();
  const shown = HOST === '0.0.0.0' ? '127.0.0.1' : HOST;
  console.log('\n  StockSentry 智能盯盘系统已启动');
  console.log(`  ▸ 监听 ${HOST}:${PORT}　本地访问 http://${shown}:${PORT}`);
  console.log(`  ▸ 自选股：${w.codes.join(', ')}`);
  console.log('  ▸ 安全基线：');
  console.log(`      跨域        ${guard.ALLOWED_ORIGINS.length ? '白名单 ' + guard.ALLOWED_ORIGINS.join(' ') : '仅同源（默认拒绝跨域）'}`);
  console.log(`      限流        ${guard.RATE_DEFAULT} 次/分，分析类 ${guard.RATE_EXPENSIVE} 次/分，SSE 并发 ${guard.MAX_CONCURRENT_SSE}`);
  console.log(`      Host 校验   已开启${guard.TRUSTED_HOSTS.length ? '（额外信任 ' + guard.TRUSTED_HOSTS.join(' ') + '）' : ''}`);
  const au = cfg.audit();
  console.log(`      凭据        已登记 ${au.registered} 项${au.configured.length ? '，已配置：' + au.configured.join(' ') : '，全部未配置（当前功能无需凭据）'}`);
  console.log('');
});
