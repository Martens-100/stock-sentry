'use strict';
/**
 * 浏览器等价自检 —— 在 Node 里重建「静态版跑在浏览器中」的执行环境。
 *
 * 为什么必须这样测：直接用 node 调 engine.analyze() 测不出浏览器侧的真实故障 ——
 * Node 的 fetch 不执行 CORS、不受代理/插件影响、也不需要 <script> 标签。
 * 所以这里把 process 删掉让 IS_NODE 降级为 false，再用 window/document 垫片
 * 精确复现浏览器执行路径，并分别验证两条链路：
 *   A) fetch 直连      —— 正常网络
 *   B) fetch 被拦      —— 靠 JSONP 兜底（企业代理 / 隐私插件 / file:// 打开）
 *
 * 用法：node scripts/verify-browser-path.js
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36';
const realFetch = globalThis.fetch;
const realProcess = process;               // 删掉全局 process 后还要用它退出

/* ---------------- 真实 HTTP（模拟 <script src> 的取回） ---------------- */
function httpText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': UA } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const cs = (/charset=([\w-]+)/i.exec(res.headers['content-type'] || '') || [])[1] || 'utf-8';
        try { resolve(new TextDecoder(cs === 'gb2312' ? 'gbk' : cs).decode(buf)); }
        catch (_) { resolve(buf.toString('utf8')); }
      });
    }).on('error', reject);
  });
}

/* ---------------- 最小 DOM 垫片：只实现 JSONP 需要的那几个接口 ---------------- */
function makeDocument(win, log) {
  const load = async (el) => {
    try {
      const code = await httpText(el.src);
      // 在 contextified 对象里执行，裸赋值 `v_sz000063="..."` 会落到 win 上，
      // 与浏览器把 JSONP 变量挂到 window 的行为一致。
      vm.runInContext(code, vm.createContext(win), { filename: el.src });
      log(`    ↳ <script> 执行完成 ${String(el.src).slice(0, 72)}`);
      if (el.onload) el.onload();
    } catch (e) {
      if (el.onerror) el.onerror(e);
    }
  };
  return {
    createElement(tag) {
      const el = { tagName: String(tag).toUpperCase(), parentNode: null, src: '' };
      el.setAttribute = (k, v) => { el[k] = v; };
      el.getAttribute = (k) => el[k];
      return el;
    },
    head: { appendChild(el) { load(el); } },
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {}
  };
}

/* ---------------- 逐场景启动 ---------------- */
async function runScenario(label, { blockFetch }) {
  const win = {};
  const log = (s) => console.log(s);

  globalThis.window = win;
  globalThis.document = makeDocument(win, log);
  win.navigator = { userAgent: 'browser-shim' };
  win.location = { href: 'https://example.invalid/stock-sentry/', origin: 'https://example.invalid', protocol: 'https:' };
  win.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  win.setTimeout = setTimeout;
  globalThis.localStorage = win.localStorage;
  globalThis.location = win.location;

  globalThis.fetch = blockFetch
    ? () => Promise.reject(new TypeError('Failed to fetch'))
    : realFetch;

  console.log(`\n=== 场景 ${label}（fetch ${blockFetch ? '被拦' : '正常'}）===`);
  new Function(fs.readFileSync(path.join(ROOT, 'docs', 'bundle.js'), 'utf8'))();
  new Function(fs.readFileSync(path.join(ROOT, 'docs', 'static-api.js'), 'utf8'))();

  if (!win.SentryLib) throw new Error('bundle.js 未创建 SentryLib');
  if (!win.SentryStatic) throw new Error('static-api.js 未创建 SentryStatic');

  const codes = ['000063', '600519', '300750'];
  for (const code of codes) {
    const r = await win.SentryStatic.handle(`/api/analyze?code=${code}`, {});
    if (!r.ok) throw new Error(`${code} 分析失败：${r.error}`);
    const d = r.data;
    const md = win.SentryLib.report.buildReport(d);
    console.log(
      `  ${code} ${String(d.name).padEnd(6)} 价=${d.quote.price}`
      + ` 综合=${d.scores.composite} 技术=${d.scores.technical} 监控=${d.scores.monitor}`
      + ` 清单=${d.monitors.length}项 来源=${d.monitorsSource}`
      + ` 画像=${d.profile.auto ? '自动' : '投研'} 报告=${md.length}字`
    );
  }

  const t = win.SentryLib.source.transportInfo();
  console.log(`  传输层：${t.mode} ｜ fetch 成功 ${t.fetchOk} / 失败 ${t.fetchFail} ｜ JSONP 成功 ${t.jsonpOk} / 失败 ${t.jsonpFail}`);
  if (blockFetch && t.jsonpOk === 0) throw new Error('fetch 被拦时 JSONP 兜底未生效');
  if (!blockFetch && t.fetchFail > 0) throw new Error('正常网络下 fetch 竟然失败，环境异常');
  console.log(`  ✅ 场景 ${label} 通过`);
}

(async () => {
  delete globalThis.process;              // 关键：让 bundle 内的 IS_NODE 降级为 false
  let failed = 0;
  for (const [label, opt] of [['A · fetch 直连', { blockFetch: false }], ['B · JSONP 兜底', { blockFetch: true }]]) {
    try { await runScenario(label, opt); }
    catch (e) { failed++; console.error(`  ❌ 场景 ${label} 失败：${e.message}`); }
  }
  console.log(failed ? `\n❌ 共 ${failed} 个场景失败` : '\n✅ 全部场景通过（浏览器路径可用）');
  realProcess.exit(failed ? 1 : 0);
})();
