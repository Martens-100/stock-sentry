'use strict';
/**
 * 密钥扫描器 —— 防止任何凭据进入源码或构建产物。
 *
 * 定位：这是"防扒取"的最后一道闸门。构建产物（尤其是要发布到 GitHub Pages 的 docs/）
 * 里的每一个字节都是公开的，所以产物生成后必须逐字节过一遍扫描器，命中即失败。
 *
 * 用法：
 *   node scripts/scan-secrets.js              # 扫描仓库源码 + docs/ 构建产物（默认）
 *   node scripts/scan-secrets.js <path...>    # 只扫描指定文件或目录
 *   node scripts/scan-secrets.js --quiet      # 只输出问题
 * 退出码：发现 error 级问题 → 1；仅有 warn → 0。
 *
 * 新增白名单：确实安全但会被误报的字符串，加到 ALLOW 数组并写明理由。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/* ================================================================== */
/* 规则                                                                */
/* ================================================================== */
/**
 * 注意：规则本身也要被扫描（不给自己开后门），所以下面凡是"看起来像密钥"的字面量
 * 都做了拼接处理，保证规则文本不会命中自己。
 */

/** 已经泄漏过、必须永远不再出现的历史遗留值 */
const DENYLIST = [
  'D43BF722' + 'C8E33BDC906FB84D85E326E8'   // 东方财富 suggest 接口 token（已改用免凭据的 smartbox）
];

const RULES = [
  /* ---- error：确凿的凭据格式 ---- */
  { id: 'provider/openai', sev: 'error', desc: 'OpenAI 风格密钥', re: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { id: 'provider/anthropic', sev: 'error', desc: 'Anthropic 风格密钥', re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g },
  { id: 'provider/aws', sev: 'error', desc: 'AWS Access Key ID', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { id: 'provider/github', sev: 'error', desc: 'GitHub Token', re: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g },
  { id: 'provider/google', sev: 'error', desc: 'Google API Key', re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { id: 'provider/slack', sev: 'error', desc: 'Slack Token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/g },
  { id: 'provider/stripe', sev: 'error', desc: 'Stripe 密钥', re: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}/g },
  { id: 'private-key', sev: 'error', desc: '私钥内容', re: new RegExp('-{5}BEGIN [A-Z ]{0,20}PRIVATE' + ' KEY-{5}', 'g') },

  /* ---- error：凭据被塞进 URL 查询串或赋值给变量 ---- */
  { id: 'url/credential', sev: 'error', desc: 'URL 查询串里带凭据', re: /[?&](?:token|key|apikey|api_key|access_token|secret|auth)=[A-Za-z0-9_\-.]{16,}/gi },
  { id: 'assign/literal', sev: 'error', desc: '疑似硬编码的密钥赋值', re: /(?:api[_-]?key|apikey|secret|token|password|passwd|pwd|credential)\s*[:=]\s*['"][A-Za-z0-9_\-+/=]{16,}['"]/gi },
  { id: 'header/bearer', sev: 'error', desc: '硬编码的 Bearer 凭据', re: /Bearer\s+[A-Za-z0-9._~+/-]{24,}/g },

  /* ---- error：浏览器产物里不该出现 Node 环境访问（等价于把服务端配置暴露出去）---- */
  { id: 'node/process-env', sev: 'error', desc: '浏览器产物中出现 process.env', re: /process\.env/g, onlyUnder: 'docs' },

  /* ---- warn：启发式，只提示不阻断 ---- */
  { id: 'heuristic/long-hex', sev: 'warn', desc: '超长十六进制串，请人工确认非密钥', re: /\b[0-9a-fA-F]{40,}\b/g },
  { id: 'heuristic/jwt', sev: 'warn', desc: '疑似 JWT', re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g }
];

/**
 * 已知安全、需要豁免的字符串（写清理由）。
 * 目前为空 —— 说明"被扫描的代码里不该出现任何豁免项"。
 * 注意：DENYLIST 里的值刻意用字符串拼接写，保证本文件自身不含连续字面量，
 * 因此扫描器可以扫描自己，不需要给自己开后门。
 */
const ALLOW = [];

/* ================================================================== */
/* 扫描                                                                */
/* ================================================================== */
const SKIP_DIRS = new Set(['.git', 'node_modules', 'outputs', '.workbuddy']);
const SKIP_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.zip', '.pdf', '.mp4']);
const MAX_BYTES = 4 * 1024 * 1024;

function rel(p) { return path.relative(ROOT, p).split(path.sep).join('/'); }

function walk(target, out = []) {
  let st;
  try { st = fs.statSync(target); } catch (_) { return out; }
  if (st.isFile()) { out.push(target); return out; }
  if (!st.isDirectory()) return out;
  for (const name of fs.readdirSync(target)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(target, name);
    let s;
    try { s = fs.statSync(full); } catch (_) { continue; }
    if (s.isDirectory()) walk(full, out);
    else if (s.isFile()) out.push(full);
  }
  return out;
}

function lineOf(text, index) { return text.slice(0, index).split('\n').length; }

/** 扫描一段文本，返回 findings[] */
function scanText(text, label) {
  const findings = [];
  const lower = label.toLowerCase();

  for (const rule of RULES) {
    if (rule.onlyUnder && !lower.startsWith(rule.onlyUnder + '/')) continue;
    rule.re.lastIndex = 0;
    let m;
    while ((m = rule.re.exec(text))) {
      const hit = m[0];
      if (ALLOW.some((a) => hit.includes(a))) continue;
      findings.push({
        rule: rule.id, sev: rule.sev, desc: rule.desc,
        file: label, line: lineOf(text, m.index),
        preview: hit.length > 60 ? hit.slice(0, 30) + '…' + hit.slice(-12) : hit
      });
      if (findings.length > 200) return findings;
    }
  }

  // 历史遗留值（构造 pattern 避免规则文本自命中）
  for (const bad of DENYLIST) {
    let idx = text.indexOf(bad);
    while (idx !== -1) {
      findings.push({
        rule: 'denylist/leaked', sev: 'error', desc: '历史遗留的已泄漏凭据',
        file: label, line: lineOf(text, idx), preview: bad.slice(0, 8) + '****'
      });
      idx = text.indexOf(bad, idx + 1);
    }
  }

  return findings;
}

function scanPath(target) {
  const files = walk(target);
  const findings = [];
  for (const f of files) {
    if (SKIP_EXT.has(path.extname(f).toLowerCase())) continue;
    let buf;
    try { buf = fs.readFileSync(f); } catch (_) { continue; }
    if (buf.length > MAX_BYTES) continue;
    // 含 NUL 字节视为二进制，跳过
    if (buf.includes(0)) continue;
    findings.push(...scanText(buf.toString('utf8'), rel(f)));
  }
  return findings;
}

/* ================================================================== */
/* CLI                                                                */
/* ================================================================== */
function main() {
  const argv = process.argv.slice(2);
  const quiet = argv.includes('--quiet');
  const targets = argv.filter((a) => !a.startsWith('--'));
  const roots = targets.length ? targets.map((t) => path.resolve(t)) : [ROOT];

  let findings = [];
  for (const r of roots) findings.push(...scanPath(r));

  const errors = findings.filter((f) => f.sev === 'error');
  const warns = findings.filter((f) => f.sev === 'warn');

  const print = (list, tag) => {
    for (const f of list) {
      console.log(`  ${tag} [${f.rule}] ${f.file}:${f.line}`);
      console.log(`      ${f.desc} → ${f.preview}`);
    }
  };

  if (!quiet) console.log(`密钥扫描：${roots.map((r) => rel(r) || '仓库根目录').join(', ')}`);

  if (errors.length) {
    console.log(`\n❌ 发现 ${errors.length} 个高危问题（阻断）：`);
    print(errors, 'ERROR');
  }
  if (warns.length) {
    console.log(`\n⚠️  ${warns.length} 个待人工确认项（不阻断）：`);
    print(warns, 'WARN');
  }
  if (!errors.length && !warns.length && !quiet) console.log('✅ 未发现任何凭据或敏感信息');

  process.exit(errors.length ? 1 : 0);
}

module.exports = { scanText, scanPath, RULES, DENYLIST, ALLOW };

if (require.main === module) main();
