'use strict';
/**
 * UI 层（DOM）端到端自检 —— 用 jsdom 真实加载 docs/ 的静态版页面。
 *
 * 与 verify-browser-path.js 的分工：
 *   前者验「数据层在浏览器里跑不跑得通」；本脚本验「页面在浏览器里长什么样」 ——
 *   尤其是「分析失败时诊断面板是否真的出现、是否包含可用信息」这条路径，
 *   因为它在正常网络下永远不会被触发，只能靠模拟故障来验证。
 *
 * 用法：NODE_PATH=<workspace>/node_modules node scripts/verify-ui-dom.js
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const PUB = path.join(ROOT, 'public');
const VERBOSE = process.argv.includes('--verbose');

let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? ' → ' + extra : ''}`); }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 在页面 realm 内暴露一个探针。
 * 关键点：app.js 顶层的 const（如 BUILD_TAG）不会成为 window 的属性，从 Node 侧
 * 访问不到；所以把探针和 app.js 放在同一次求值里注入 —— 同一个作用域，想拿什么
 * 都能拿到，也免去依赖各引擎对「全局词法作用域」的实现差异。
 */
const PROBE = `
;window.__probe = {
  build: BUILD_TAG,
  transport: function () { try { return SentryLib.source.transportInfo(); } catch (e) { return { error: e.message }; } },
  diag: function (e, c) { return showDiag(e, c); },
  clear: function () { return clearDiag(); }
};`;

function injectApp(win, appSrc) {
  win.eval(appSrc + PROBE);
}

/** jsdom 没有 canvas 实现，用一个「吃什么返回什么」的 2D 上下文占位 */
function stubCanvas(win) {
  const make = () => new Proxy({}, {
    get: (t, k) => {
      if (k in t) return t[k];
      if (k === 'measureText') return () => ({ width: 0 });
      t[k] = () => {};
      return t[k];
    },
    set: (t, k, v) => { t[k] = v; return true; }
  });
  win.HTMLCanvasElement.prototype.getContext = () => make();
}

/**
 * 建一个静态版页面。
 * @param {{injectBundle:boolean, blockFetch:boolean}} opt
 */
function buildDom(opt) {
  let html = fs.readFileSync(path.join(DOCS, 'index.html'), 'utf8')
    .replace(/<link[^>]*style\.css[^>]*>/g, '')
    .replace(/<script[^>]*><\/script>/g, '');   // 脚本改为手动注入，避免 jsdom 去网上抓
  const vc = new VirtualConsole();
  if (VERBOSE) vc.on('jsdomError', (e) => console.error('   [jsdom]', e.message));
  const dom = new JSDOM(html, {
    url: 'https://example.invalid/stock-sentry/',
    runScripts: 'dangerously',
    resources: 'usable',        // 允许动态插入的 <script>（即 JSONP）真正执行
    pretendToBeVisual: true,
    virtualConsole: vc
  });
  const win = dom.window;
  stubCanvas(win);
  win.__SENTRY_STATIC__ = true;
  if (opt.blockFetch) {
    win.fetch = () => Promise.reject(new TypeError('Failed to fetch'));   // 模拟被拦
  }
  if (opt.injectBundle) {
    win.eval(fs.readFileSync(path.join(DOCS, 'bundle.js'), 'utf8'));
    win.eval(fs.readFileSync(path.join(DOCS, 'static-api.js'), 'utf8'));
  }
  injectApp(win, fs.readFileSync(path.join(DOCS, 'app.js'), 'utf8'));
  return dom;
}

(async () => {
  /* ---------- 场景 1：fetch 被拦，但 JSONP 能兜底 → 页面应正常出结论 ---------- */
  console.log('\n场景 1 · 页面加载 + fetch 被拦（走 JSONP 兜底）');
  const dom1 = buildDom({ injectBundle: true, blockFetch: true });
  const w1 = dom1.window;
  for (let i = 0; i < 60 && w1.document.querySelector('#detail').hidden; i++) await sleep(500);

  const det = w1.document.querySelector('#detail');
  check('页面启动后自动选中首只标的并渲染详情', !det.hidden);
  check('诊断面板保持隐藏（无失败）', w1.document.querySelector('#emptyDiag').hidden);
  check('顶栏出现版本号', /^v\d/.test(w1.document.querySelector('#buildTag').textContent),
    JSON.stringify(w1.document.querySelector('#buildTag').textContent));
  check('详情页输出了盯盘结论', (w1.document.querySelector('#verdictCard')?.textContent || '').length > 10);
  const t1 = w1.__probe.transport();
  check('传输层已自动切到 JSONP 兜底', t1.jsonpOk > 0, JSON.stringify(t1));

  /* ---------- 场景 2：人为制造失败 → 诊断面板必须出现且信息可用 ---------- */
  console.log('\n场景 2 · 分析失败 → 诊断面板');
  w1.__probe.diag(new TypeError('Failed to fetch'), '000063');
  const box = w1.document.querySelector('#emptyDiag');
  const txt = box.textContent;
  check('诊断面板已显示', !box.hidden);
  check('面板含「分析失败」标题', /分析失败/.test(txt));
  check('面板给出原因结论（含「网络层问题」）', /网络层问题/.test(txt));
  check('面板含错误原文 Failed to fetch', /Failed to fetch/.test(txt));
  check('面板含运行模式说明（静态版 / 不需要任何配置）', /不需要任何配置/.test(txt));
  check('面板含传输层自述', /fetch 成功/.test(txt));
  check('面板带三个动作按钮', ['#diagCopy', '#diagRun', '#diagReload'].every((s) => box.querySelector(s)));
  await sleep(3000);
  check('网络自检已自动跑出结果行', box.querySelectorAll('#diagOut .diag-row').length >= 6,
    box.querySelector('#diagOut').textContent.slice(0, 120));

  /* ---------- 场景 3：bundle.js 没加载（最典型的真实故障）---------- */
  console.log('\n场景 3 · bundle.js 未加载（脚本被拦 / 页面只加载了一半）');
  const dom3 = buildDom({ injectBundle: false, blockFetch: true });
  const w3 = dom3.window;
  await sleep(1200);
  w3.__probe.diag(new Error('HTTP 404'), '000063');
  const txt3 = w3.document.querySelector('#emptyDiag').textContent;
  check('面板指出 bundle.js 未加载', /bundle\.js/.test(txt3) && /未加载/.test(txt3));
  check('面板给出「强制刷新」的可操作建议', /强制刷新/.test(txt3));

  console.log(`\n通过 ${pass} 项，失败 ${fail} 项`);
  dom1.window.close(); dom3.window.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('测试异常：', e); process.exit(1); });
