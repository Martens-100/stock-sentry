'use strict';
/**
 * 凭据与运行配置的唯一入口。
 *
 * 三条铁律：
 *   1. 源码里绝不出现任何密钥字面量 —— 一切敏感值只从服务端环境变量读取；
 *   2. 任何读取密钥的代码必须包在 `@node-only` 区块内，打包成浏览器产物时会被整段剥离；
 *   3. 浏览器侧一律拿到空字符串，静态产物里不存在凭据，也就无从"扒取"。
 *
 * 新增密钥的流程：在 .env.example 里加一行说明 → 在 SECRETS 登记表里登记 → 业务代码用 secret('名称') 取。
 */
const IS_NODE = typeof process !== 'undefined' && !!(process.versions && process.versions.node);

/* @node-only */
/**
 * 极简 .env 加载器（零依赖）。已存在的环境变量优先，所以部署平台的密钥配置不会被本地文件覆盖。
 * 整段位于 @node-only 区块内 —— 打包成浏览器产物时连同这段读取逻辑一起消失。
 */
(function loadDotEnv() {
  if (!IS_NODE) return;
  try {
    const fs = require('fs');
    const path = require('path');
    const file = path.join(__dirname, '..', '.env');
    if (!fs.existsSync(file)) return;
    for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if (val.length > 1 && ((val[0] === '"' && val.endsWith('"')) || (val[0] === "'" && val.endsWith("'")))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch (_) { /* .env 不存在或不可读都属正常 */ }
})();
/* @end-node-only */

/**
 * 密钥登记表。name → 说明。
 * 登记的意义：启动时能审计"哪些密钥已配置"，日志里能统一脱敏，扫描脚本也知道该盯哪些名字。
 */
const SECRETS = {
  EASTMONEY_TOKEN: '东方财富股票联想接口 token（可选）。仅服务端使用；不配置则搜索走腾讯 smartbox，无需任何凭据。'
};

/** 读取环境变量。浏览器端恒返回空串，绝不回落到任何硬编码默认值。 */
function readEnv(name) {
  /* @node-only */
  if (IS_NODE) {
    try { return process.env[name] || ''; } catch (_) { return ''; }
  }
  /* @end-node-only */
  return '';
}

/** 取一个密钥。禁止给敏感项传 fallback —— 缺失就应该显式降级，而不是用一个人的 key 兜底给所有人。 */
function secret(name) {
  if (!(name in SECRETS)) {
    throw new Error(`[config] 未登记的密钥 "${name}"：请先在 lib/config.js 的 SECRETS 中登记`);
  }
  return readEnv(name).trim();
}

function hasSecret(name) { return secret(name).length > 0; }

/** 取普通配置项（非敏感），可以有安全的默认值。 */
function option(name, fallback) {
  const v = readEnv(name);
  return v === '' ? fallback : v;
}
function num(name, fallback) {
  const v = parseFloat(readEnv(name));
  return Number.isFinite(v) ? v : fallback;
}
function flag(name, fallback = false) {
  const v = readEnv(name).toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return fallback;
}

/** 脱敏，仅用于日志/界面展示。永远不要直接把密钥打进日志。 */
function redact(value) {
  const s = String(value == null ? '' : value);
  if (!s) return '(空)';
  if (s.length <= 8) return s[0] + '*'.repeat(Math.max(1, s.length - 1));
  return `${s.slice(0, 4)}${'*'.repeat(Math.min(12, s.length - 6))}${s.slice(-2)}`;
}

/** 启动审计：只输出"是否已配置"，绝不输出值。 */
function audit() {
  const names = Object.keys(SECRETS);
  if (!names.length) return { registered: 0, configured: [], missing: [] };
  const configured = [], missing = [];
  for (const n of names) (hasSecret(n) ? configured : missing).push(n);
  return { registered: names.length, configured, missing };
}

module.exports = { IS_NODE, IS_BROWSER: !IS_NODE, SECRETS, secret, hasSecret, option, num, flag, redact, audit };
