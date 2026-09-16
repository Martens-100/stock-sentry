'use strict';
/**
 * 真机引擎验证 —— 用 Playwright 的 **WebKit**（Safari 的内核）打开线上站点。
 *
 * 为什么需要它：前面两个自检脚本分别用 Node 的 fetch 与 jsdom，
 * 两者都不执行 CORS、不做 MIME 校验、也没有 Safari 的网络行为，
 * 因此「在 Safari 上到底会发生什么」始终是盲区。iPhone 上的报错
 * 只可能从 WebKit 复现或用 WebKit 证伪。
 *
 * 用法：
 *   node scripts/verify-live-webkit.js [url]
 *   node scripts/verify-live-webkit.js [url] --block-fetch
 *     --block-fetch 精确模拟「fetch 被拦但 <script> 仍可加载」的环境
 *     （广告拦截插件、隐私保护、部分企业代理都表现为此），
 *     用来在真 WebKit 上验证 JSONP 兜底到底是活的还是死的。
 * 默认 url = https://stocksentry-ashare.app.workbuddy.host/
 */
const { webkit, devices } = require('playwright');

const URL = process.argv[2] && !process.argv[2].startsWith('--')
  ? process.argv[2] : 'https://stocksentry-ashare.app.workbuddy.host/';
const BLOCK_FETCH = process.argv.includes('--block-fetch');

(async () => {
  const browser = await webkit.launch();
  // 用 iPhone 的视口 + UA + 触摸特性，尽量贴近朋友的设备
  const ctx = await browser.newContext({ ...devices['iPhone 15'], ignoreHTTPSErrors: false });
  const page = await ctx.newPage();

  if (BLOCK_FETCH) {
    // 只拦 fetch/XHR（resourceType 非 script），放行 <script src> 加载 ——
    // 这正好是 JSONP 兜底唯一能救命的那种封锁方式。
    await page.route('**://*.gtimg.cn/**', (route) => {
      const type = route.request().resourceType();
      if (type === 'script') return route.continue();
      return route.abort('failed');
    });
    console.log('（已启用 --block-fetch：拦截 fetch/XHR 到 *.gtimg.cn，仅放行 <script>）');
  }

  const consoleMsgs = [], pageErrors = [], failedReqs = [];
  page.on('console', (m) => consoleMsgs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('requestfailed', (r) => failedReqs.push(`${r.url().slice(0, 120)} → ${(r.failure() || {}).errorText}`));

  console.log(`\n=== WebKit（Safari 内核）打开 ${URL} ===`);
  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });

  // 注意：不能用「详情区可见」当完成条件 —— selectStock 一开始就把它设为可见了，
  // 响应还没回来时就已经满足，会得到「标的=—」这种假象。必须等真实数据落地。
  const settled = await page.waitForFunction(() => {
    const g = document.querySelector('#emptyDiag');
    if (g && !g.hidden) return true;                       // 失败：诊断面板出现
    const n = document.querySelector('#sName');
    return n && n.textContent && n.textContent !== '—';    // 成功：标的名称已渲染
  }, { timeout: 90000 }).then(() => true).catch(() => false);

  const st = await page.evaluate(() => {
    const g = document.querySelector('#emptyDiag');
    return {
      staticMode: !!window.__SENTRY_STATIC__,
      hasLib: !!window.SentryLib,
      hasStaticApi: !!window.SentryStatic,
      detailVisible: !document.querySelector('#detail').hidden,
      diagVisible: !!(g && !g.hidden),
      diagText: g ? g.innerText.slice(0, 2000) : '',
      verdict: (document.querySelector('#verdictCard') || {}).innerText || '',
      stockName: (document.querySelector('#sName') || {}).textContent || '',
      transport: (() => { try { return window.SentryLib.source.transportInfo(); } catch (e) { return 'ERR: ' + e.message; } })()
    };
  });

  console.log(`  运行模式 / 运行时：staticMode=${st.staticMode} SentryLib=${st.hasLib} SentryStatic=${st.hasStaticApi}`);
  console.log(`  界面：详情区可见=${st.detailVisible}  诊断面板可见=${st.diagVisible}  标的=${st.stockName}`);
  console.log(`  传输层：${typeof st.transport === 'object' ? JSON.stringify(st.transport) : st.transport}`);
  if (st.verdict) console.log(`  结论摘要：${st.verdict.replace(/\s+/g, ' ').slice(0, 160)}`);
  if (st.diagText) console.log(`  诊断面板内容：\n${st.diagText.split('\n').map((l) => '    ' + l).join('\n')}`);
  if (failedReqs.length) { console.log('  请求失败：'); failedReqs.forEach((f) => console.log('    ' + f)); }
  if (pageErrors.length) { console.log('  页面异常：'); pageErrors.forEach((e) => console.log('    ' + e)); }
  if (consoleMsgs.length) { console.log('  控制台：'); consoleMsgs.slice(0, 15).forEach((m) => console.log('    ' + m)); }
  if (!settled) console.log('  ⚠️ 等待超时：既没渲染出详情，也没出现诊断面板');

  const ok = st.detailVisible && !st.diagVisible && st.stockName && st.stockName !== '—';
  console.log(`\n${ok ? '✅ WebKit 下可用（分析成功）' : '❌ WebKit 下不可用（已复现故障）'}`);
  await browser.close();
  process.exit(ok ? 0 : 2);
})().catch((e) => { console.error('测试异常：', e.message); process.exit(1); });
