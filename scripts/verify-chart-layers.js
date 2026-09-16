'use strict';
/**
 * 图表分层渲染验证 —— 逐层断言「布林上下轨 / 回归导轨 / 均线」真的画在画布上了。
 *
 * 为什么必须单独做这一层：布局断言（verify-planE-webkit）只能证明"画布有宽度"，
 * 证明不了"画布上有那几条线"。而这次问题的本质正是——画布宽高都正常、
 * 页面零异常、JS 一行不报错，可用户看到的图就是空的。这种"沉默的空白"
 * 有至少五条独立通路（数据源没给 / 样本不足 / 序列没对齐 / 画布宽度为 0 / 值域混进 NaN），
 * 外观完全一样。所以这里不测"代码写了没有"，而是**数画布上的像素**，
 * 并且逐条把故障注入进去，确认每一种故障都有可见的交代。
 *
 * 用法：
 *   NODE_PATH=<workspace>/node_modules node scripts/verify-chart-layers.js
 *   NODE_PATH=... node scripts/verify-chart-layers.js --standalone    单文件版（file://）
 *   NODE_PATH=... node scripts/verify-chart-layers.js --block-fetch   只放行 <script>
 *   NODE_PATH=... node scripts/verify-chart-layers.js https://xxx/    直接验线上部署产物
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { webkit, devices } = require('playwright');

const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const SHOTS = path.join(ROOT, '_shots');
const BLOCK_FETCH = process.argv.includes('--block-fetch');
const STANDALONE = process.argv.includes('--standalone');
const REMOTE_URL = process.argv.slice(2).find((a) => /^https?:\/\//.test(a)) || null;
const SHOT = REMOTE_URL ? 'layers-live-' : STANDALONE ? 'layers-standalone-' : 'layers-';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8'
};

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; failures.push(name + (extra ? ` → ${extra}` : '')); console.log(`  ❌ ${name}${extra ? ' → ' + extra : ''}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      const file = path.join(DOCS, url === '/' ? 'index.html' : url.replace(/^\/+/, ''));
      if (!file.startsWith(DOCS) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}

/* ---------------- 画布像素探针 ----------------
   颜色容差必须压到能区分"同类但不同层"的程度，否则会把 K 线红绿当成布林线：
     布林上轨 #e91e63(233,30,99) vs 阳线 #d0342c(208,52,44) → B 通道差 55，容差 28 可区分
     布林下轨 #00acc1(0,172,193) vs 阴线 #12855a(18,133,90) → G 通道差 39，容差 28 可区分
     导轨     #ff9800(255,152,0)  vs 均价/MA5 #e6a23c(230,162,60) → B 通道差 60，容差 30 可区分
   这样数出来的像素数才是"这条线在场"的证据，而不是别的什么线贡献的。 */
const PROBE = `(() => {
  const cv = document.querySelector('#klineChart');
  if (!cv) return { err: 'no #klineChart' };
  const W = cv.width, H = cv.height;
  const rect = cv.getBoundingClientRect();
  const base = { backingW: W, backingH: H, rectW: Math.round(rect.width), rectH: Math.round(rect.height) };
  if (!W || !H) return Object.assign(base, { note: '位图为 0，画布上没有东西' });
  const img = cv.getContext('2d').getImageData(0, 0, W, H).data;
  const near = (r0, g0, b0, d) => (r, g, b) => Math.abs(r - r0) <= d && Math.abs(g - g0) <= d && Math.abs(b - b0) <= d;
  const isBollUp = near(233, 30, 99, 28), isBollDn = near(0, 172, 193, 28), isRail = near(255, 152, 0, 30);
  let up = 0, dn = 0, rail = 0, ink = 0;
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      const i = (y * W + x) * 4;
      if (img[i + 3] < 60) continue;
      const R = img[i], G = img[i + 1], B = img[i + 2];
      if (isBollUp(R, G, B)) up++;
      if (isBollDn(R, G, B)) dn++;
      if (isRail(R, G, B)) rail++;
      if (R < 200 && G < 200 && B < 200) ink++;     // 有任何深色内容（含提示文字）
    }
  }
  const viz = document.querySelector('#railViz');
  const rows = [];
  if (viz) {
    viz.querySelectorAll('.rv-row').forEach((r) => {
      const tr = r.querySelector('.rv-track');
      const b = tr && tr.getBoundingClientRect();
      rows.push({
        label: (r.querySelector('.rv-label') || {}).textContent || '',
        empty: r.classList.contains('rv-row-empty'),
        trackW: b ? Math.round(b.width) : 0,
        trackH: b ? Math.round(b.height) : 0,
        val: (r.querySelector('.rv-val') || {}).textContent || ''
      });
    });
  }
  const note = document.querySelector('#klineNote');
  const mnote = document.querySelector('#minuteNote');
  const vizText = viz ? viz.textContent.replace(/\\s+/g, ' ').trim() : '';
  return Object.assign(base, {
    bollUpPx: up, bollDnPx: dn, railPx: rail, inkPx: ink,
    railRows: rows,
    railVizText: vizText,
    railVizHint: !!(viz && viz.querySelector('.rv-empty-hint')),
    chGridText: ((document.querySelector('#chGrid') || {}).textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 120),
    noteHidden: !note || note.hidden, noteText: note ? note.textContent : '',
    minuteNoteHidden: !mnote || mnote.hidden, minuteNoteText: mnote ? mnote.textContent : '',
    pendingSize: !!(window.__chartDiag && /尺寸异常.*是/.test(window.__chartDiag())),
    diag: window.__chartDiag ? window.__chartDiag() : '(无 __chartDiag)'
  });
})()`;

const read = (page) => page.evaluate(PROBE);

/* ==========================================================================
   数据层契约（在 Node 侧先跑，不需要浏览器）
   --------------------------------------------------------------------------
   这一节钉的是**对齐契约**本身：三条序列必须同长、导轨的 offset 必须等于
   其首点日期在 K 线里的下标、末根 K 线必须与实时价同步。

   为什么要专门钉住：原来的偏移是客户端用 `k.length - rails.bars` 反推出来的，
   这个等式今天成立、明天可能就不成立，而一旦不成立，导轨会被整体画到画布之外 ——
   图上看就是「导轨没了」，且不抛错、不告警。把契约变成断言，比在注释里写
   「注意对齐」有用得多。
   ========================================================================== */
function verifyDataContract() {
  console.log('【0】数据层对齐契约（Node 侧）');
  let engine;
  try { engine = require('../lib/engine'); } catch (e) { check('能加载分析引擎', false, e.message); return Promise.resolve(); }
  const codes = ['000063', '002422', '000032'];
  return Promise.all(codes.map(async (c) => {
    try {
      const r = await engine.analyze(c);
      const ch = r.chart;
      check(`${c} · chart.bars 与 kline/dates 长度一致`,
        ch.bars === ch.kline.length && ch.bars === ch.dates.length,
        `bars=${ch.bars} kline=${ch.kline.length} dates=${ch.dates.length}`);
      const seriesOk = [ch.boll && ch.boll.up, ch.boll && ch.boll.mid, ch.boll && ch.boll.dn,
        ch.macd.dif, ch.macd.dea, ch.macd.hist]
        .filter(Boolean).every((a) => a.length === ch.bars);
      check(`${c} · 布林三轨与 MACD 三条序列都对齐到 bars`, seriesOk);
      check(`${c} · 没有 degraded（正常行情应取到完整日K）`, !ch.degraded, JSON.stringify(ch.degraded));
      check(`${c} · 布林末值与指标快照一致`,
        Math.abs((ch.boll.up[ch.boll.up.length - 1]) - r.ind.boll.up) < 0.02,
        `${ch.boll.up[ch.boll.up.length - 1]} vs ${r.ind.boll.up}`);
      check(`${c} · 末根K线收盘价与实时价同步（保证布林/导轨随实时更新）`,
        ch.kline[ch.kline.length - 1].close === r.quote.price,
        `kline=${ch.kline[ch.kline.length - 1].close} quote=${r.quote.price}`);
      if (ch.rails) {
        const kd = ch.dates;
        const firstIdx = kd.indexOf(ch.rails.dates[0]);
        const lastIdx = kd.lastIndexOf(ch.rails.dates[ch.rails.dates.length - 1]);
        check(`${c} · 导轨首点日期下标 === 载荷 offset（对齐锚点可信）`,
          firstIdx === ch.rails.offset && firstIdx >= 0, `byDate=${firstIdx} offset=${ch.rails.offset}`);
        check(`${c} · 导轨末点落在 K 线最后一根上`,
          lastIdx === ch.bars - 1, `lastIdx=${lastIdx} bars-1=${ch.bars - 1}`);
        check(`${c} · 导轨三条序列与其 bars 一致`,
          ch.rails.up.length === ch.rails.bars && ch.rails.mid.length === ch.rails.bars && ch.rails.dn.length === ch.rails.bars,
          `up=${ch.rails.up.length} mid=${ch.rails.mid.length} dn=${ch.rails.dn.length} bars=${ch.rails.bars}`);
      } else {
        check(`${c} · 导轨序列可用（正常行情应能拟合出通道）`, false, 'rails=null');
      }
    } catch (e) {
      check(`${c} · 分析成功`, false, e.message);
    }
  }));
}

(async () => {
  await verifyDataContract();
  console.log('');
  fs.mkdirSync(SHOTS, { recursive: true });
  let serverInfo = null;
  let base;
  if (STANDALONE) {
    base = 'file://' + path.join(ROOT, 'out', 'stock-sentry-standalone.html');
  } else if (REMOTE_URL) {
    base = REMOTE_URL;
  } else {
    serverInfo = await serve();
    base = `http://127.0.0.1:${serverInfo.port}/`;
  }

  const browser = await webkit.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 15'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  if (BLOCK_FETCH) {
    await page.route('**/*', (route) => {
      const t = route.request().resourceType();
      if (t === 'fetch' || t === 'xhr') return route.abort();
      return route.continue();
    });
  }

  console.log(`\n打开 ${base}${BLOCK_FETCH ? '（只放行 <script>）' : ''}\n`);
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);

  /* ================= 【1】展开后：布林上下轨与导轨必须在画布上 ================= */
  console.log('【1】展开后逐层像素（移动端视口）');
  await page.evaluate(() => document.querySelectorAll('.chart-kline .chart-toggle').forEach((b) => b.click()));
  await page.waitForTimeout(1200);
  let s = await read(page);
  console.log('   ', JSON.stringify({ W: s.backingW, H: s.backingH, bollUp: s.bollUpPx, bollDn: s.bollDnPx, rail: s.railPx, ink: s.inkPx }));
  check('画布位图非 0（有真实绘制面积）', s.backingW > 0 && s.backingH > 0, `W=${s.backingW} H=${s.backingH}`);
  check('布林上轨线已绘制（画布上有其专属颜色像素）', s.bollUpPx >= 120, `bollUpPx=${s.bollUpPx}`);
  check('布林下轨线已绘制', s.bollDnPx >= 120, `bollDnPx=${s.bollDnPx}`);
  check('回归导轨通道已绘制', s.railPx >= 90, `railPx=${s.railPx}`);
  check('画布未处于"尺寸不可用"状态', !s.pendingSize, s.pendingSize ? '仍登记为待补画' : '');
  await page.screenshot({ path: path.join(SHOTS, SHOT + '1-kline.png') });

  /* ================= 【2】轨道可视化区：三行都在且轨道有宽度 ================= */
  console.log('\n【2】「上下轨线与导轨区间研判」可视化区');
  check('轨道区有 3 行（布林 / 回归导轨 / 唐奇安）', s.railRows.length === 3, `实际 ${s.railRows.length} 行：${s.railRows.map((r) => r.label).join('/')}`);
  check('每行轨道条都有非零宽度', s.railRows.every((r) => r.trackW > 0), JSON.stringify(s.railRows.map((r) => r.trackW)));
  check('数据正常时不应出现「不可用」占位行', s.railRows.every((r) => !r.empty), JSON.stringify(s.railRows.filter((r) => r.empty).map((r) => r.label)));

  /* ================= 【3】开关：每一层都必须真的被切掉（含曾经失效的均线） ================= */
  console.log('\n【3】叠加层开关');
  const setOpt = (opt, on) => page.evaluate(([o, v]) => {
    const el = document.querySelector('.chart-toggles input[data-opt="' + o + '"]');
    if (!el) return 'no-el';
    el.checked = v;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return 'ok';
  }, [opt, on]);

  await setOpt('boll', false); await sleep(500);
  let r1 = await read(page);
  check('关掉「布林上下轨」后布林线消失', r1.bollUpPx === 0 && r1.bollDnPx === 0, `up=${r1.bollUpPx} dn=${r1.bollDnPx}`);
  check('关掉布林不影响导轨（两层独立）', r1.railPx >= 90, `railPx=${r1.railPx}`);
  await setOpt('boll', true);

  await setOpt('rail', false); await sleep(500);
  let r2 = await read(page);
  check('关掉「回归导轨通道」后导轨消失', r2.railPx === 0, `railPx=${r2.railPx}`);
  check('关掉导轨不影响布林', r2.bollUpPx >= 120, `bollUpPx=${r2.bollUpPx}`);
  await setOpt('rail', true);

  await setOpt('ma', false); await sleep(500);
  let r3 = await read(page);
  const maOffDiff = Math.abs(r3.inkPx - r2.inkPx) + Math.abs(r3.bollUpPx - r2.bollUpPx);
  await setOpt('ma', true); await sleep(500);
  let r4 = await read(page);
  check('「均线」开关真的生效（曾经因 id 大小写不匹配而完全失效）', maOffDiff > 0 || r4.inkPx !== r3.inkPx,
    `ma off ink=${r3.inkPx} / ma on ink=${r4.inkPx}`);
  check('均线关掉后布林与导轨仍在', r3.bollUpPx >= 100 && r3.railPx >= 80, `up=${r3.bollUpPx} rail=${r3.railPx}`);

  /* ================= 【4】换股 / 折叠展开 / 断点切换后仍不空 ================= */
  console.log('\n【4】交互状态下的稳定性');
  const codes = await page.evaluate(() => Array.from(document.querySelectorAll('.watchlist .wl-item')).map((e) => e.dataset.code));
  for (const code of codes.slice(1, 3)) {
    await page.evaluate((c) => document.querySelector('.wl-item[data-code="' + c + '"]').click(), code);
    await page.waitForTimeout(3200);
    const x = await read(page);
    check(`换到 ${code} 后布林与导轨仍有内容`, x.bollUpPx >= 100 && x.railPx >= 60, `up=${x.bollUpPx} rail=${x.railPx}`);
    check(`换到 ${code} 后轨道区三行都在`, x.railRows.length === 3, `${x.railRows.length} 行`);
  }

  await page.evaluate(() => document.querySelector('.chart-kline .chart-toggle').click());  // 折叠
  await sleep(500);
  await page.evaluate(() => document.querySelector('.chart-kline .chart-toggle').click());  // 再展开
  await sleep(1100);
  const x5 = await read(page);
  check('折叠后重新展开仍有布林与导轨（补画链路生效）', x5.bollUpPx >= 100 && x5.railPx >= 60, `up=${x5.bollUpPx} rail=${x5.railPx}`);
  check('重新展开后没有遗留"待补画"状态', !x5.pendingSize);

  await page.setViewportSize({ width: 1180, height: 900 });
  await sleep(1200);
  const x6 = await read(page);
  check('切到桌面宽度后布林与导轨按新宽度重画', x6.bollUpPx >= 200 && x6.railPx >= 150, `up=${x6.bollUpPx} rail=${x6.railPx}`);
  await page.screenshot({ path: path.join(SHOTS, SHOT + '2-desktop.png') });

  /* ================= 【5】故障注入 ①：数据源没给日K（本次问题的核心场景） =================
     注意注入必须**同时**掏空 ind 里那几项：真实世界里 kline 为空时，
     computeIndicators 算出的 bollInfo / rails / channelVerdict 也会跟着没有。
     只把 chart 掏空、留着 ind，是一个不可能出现的中间态 ——
     拿它做断言会得出"轨道图还有数据"这种假结论。 */
  console.log('\n【5】注入「数据源未返回日K」（chart 与 ind 同时降级）');
  const injectDegraded = () => page.evaluate(() => {
    const S = window.SentryStatic;
    if (!S || !S.handle) return 'no SentryStatic';
    if (!S.__orig) S.__orig = S.handle.bind(S);      // 只记一次原函数，避免补丁一层套一层
    const orig = S.__orig;
    S.handle = async (p, o) => {
      const res = await orig(p, o);
      if (p.indexOf('/api/analyze') === 0 && res && res.ok && res.data && res.data.chart) {
        const ch = res.data.chart, ind = res.data.ind;
        ch.kline = []; ch.dates = [];
        ch.boll = null; ch.rails = null;
        ch.macd = { dif: [], dea: [], hist: [] };
        ch.minutes = [];
        ch.degraded = { reason: 'no-kline', bars: 0, text: '数据源未返回日K数据' };
        if (ind) {
          ind.boll = { up: null, mid: null, dn: null };
          ind.bollInfo = null; ind.rails = null; ind.donchian = null; ind.channelVerdict = null;
          ind.ma = { ma5: null, ma10: null, ma20: null, ma60: null, ma30: null, ma120: null, ma250: null };
        }
        res.data.chartInfo = null;
      }
      return res;
    };
    return 'ok';
  });
  const restoreHandle = () => page.evaluate(() => {
    const S = window.SentryStatic;
    if (S && S.__orig) S.handle = S.__orig;
    return 'restored';
  });
  /** 让页面丢掉当前 state.data 并重新分析：切走再切回即可 */
  const reanalyze = async (first) => {
    const other = (await page.evaluate((f) => Array.from(document.querySelectorAll('.watchlist .wl-item')).map((e) => e.dataset.code).find((c) => c !== f), first));
    await page.evaluate((c) => document.querySelector('.wl-item[data-code="' + c + '"]').click(), other);
    await page.waitForTimeout(1200);
    await page.evaluate((c) => document.querySelector('.wl-item[data-code="' + c + '"]').click(), first);
    await page.waitForTimeout(3600);
  };

  check('能够注入"空日K"载荷（用于复现用户场景）', (await injectDegraded()) === 'ok');
  const first = await page.evaluate(() => (document.querySelector('.wl-item') || {}).dataset?.code);
  await reanalyze(first);
  const bad = await read(page);
  console.log('   ', JSON.stringify({ bollUp: bad.bollUpPx, rail: bad.railPx, ink: bad.inkPx, noteHidden: bad.noteHidden, rows: bad.railRows.length, hint: bad.railVizHint }));
  check('空日K时画布上仍给出可见说明（不是沉默的空白）', bad.inkPx > 0, `inkPx=${bad.inkPx}`);
  check('空日K时页面给出「暂不可用」的原因说明', !bad.noteHidden && /暂不可用/.test(bad.noteText), `hidden=${bad.noteHidden} text="${bad.noteText}"`);
  check('空日K时轨道可视化区给出明确不可用说明（而不是留着上一只的旧图）',
    bad.railVizHint || /不可用/.test(bad.railVizText), `hint=${bad.railVizHint} text="${bad.railVizText.slice(0, 60)}"`);
  check('空日K时研判格也明确说明不可用', /不可用/.test(bad.chGridText), bad.chGridText.slice(0, 60));
  check('图表自检能报出降级原因（远程排查用）', /no-kline|降级原因/.test(bad.diag));
  await page.evaluate(() => document.querySelector('.channel-card') && document.querySelector('.channel-card').scrollIntoView({ block: 'start' }));
  await sleep(350);
  await page.screenshot({ path: path.join(SHOTS, SHOT + '3-degraded.png') });

  /* ================= 【5b】故障注入 ①b：K线在、但某几层指标缺失 =================
     这是真实会发生的中间态：导轨的拟合窗口要求 ≥12 根，样本不足时 rails 为 null；
     布林带也可能因为数据源只回了几根而缺失。此时期望是**三行占位**而不是行消失。 */
  console.log('\n【5b】注入「K线在、但布林/导轨/唐奇安都缺失」');
  await page.evaluate(() => {
    const S = window.SentryStatic;
    const orig = S.__orig;
    S.handle = async (p, o) => {
      const res = await orig(p, o);
      if (p.indexOf('/api/analyze') === 0 && res && res.ok && res.data && res.data.ind) {
        res.data.chart.boll = null;
        res.data.chart.rails = null;
        res.data.ind.bollInfo = null;
        res.data.ind.rails = null;
        res.data.ind.donchian = null;
        res.data.chart.degraded = null;
      }
      return res;
    };
    return 'ok';
  });
  await reanalyze(first);
  const partial = await read(page);
  console.log('   ', JSON.stringify({ bollUp: partial.bollUpPx, rail: partial.railPx, ink: partial.inkPx, rows: partial.railRows.length, empty: partial.railRows.map((r) => r.empty) }));
  check('K线仍在：蜡烛与 MACD 照常绘制', partial.inkPx > 200, `inkPx=${partial.inkPx}`);
  check('布林/导轨确实没画（验证注入生效）', partial.bollUpPx === 0 && partial.railPx === 0, `up=${partial.bollUpPx} rail=${partial.railPx}`);
  check('三层指标缺失时，轨道区仍保留 3 行而不是静默消失', partial.railRows.length === 3, `${partial.railRows.length} 行`);
  check('缺失的每一行都标注「不可用」并给出原因', partial.railRows.every((r) => r.empty && /不可用/.test(r.val)), JSON.stringify(partial.railRows.map((r) => r.val)));
  await page.evaluate(() => document.querySelector('.chart-kline') && document.querySelector('.chart-kline').scrollIntoView({ block: 'start' }));
  await sleep(350);
  await page.screenshot({ path: path.join(SHOTS, SHOT + '4-partial.png') });

  /* ================= 【6】故障注入 ②：值域里混进 NaN ================= */
  console.log('\n【6】注入「K线数值异常（NaN）」');
  await page.evaluate(() => {
    const S = window.SentryStatic;
    const orig = S.__orig;      // 从原函数再包一次，确保【5】的补丁已彻底脱下
    S.handle = async (p, o) => {
      const res = await orig(p, o);
      if (p.indexOf('/api/analyze') === 0 && res && res.ok && res.data && res.data.chart && res.data.chart.kline.length) {
        res.data.chart.kline = res.data.chart.kline.map((b, i) => (i % 3 === 0 ? { ...b, high: NaN, low: NaN } : b));
        res.data.chart.degraded = null;
      }
      return res;
    };
    return 'ok';
  });
  await reanalyze(first);
  const nan = await read(page);
  console.log('   ', JSON.stringify({ bollUp: nan.bollUpPx, rail: nan.railPx, ink: nan.inkPx }));
  check('NaN 行情不会让整张图静默变白（仍有绘制内容）', nan.inkPx > 0, `inkPx=${nan.inkPx}`);
  check('NaN 行情下布林与导轨仍按有限值绘制', nan.bollUpPx >= 80 && nan.railPx >= 50, `up=${nan.bollUpPx} rail=${nan.railPx}`);

  /* ================= 【7】画布尺寸为 0：必须登记待补画并能自愈 ================= */
  console.log('\n【7】画布尺寸不可用时的自愈');
  await restoreHandle();
  await reanalyze(first);
  const before7 = await read(page);
  check('自愈测试前置条件：恢复真实载荷后布林与导轨在场', before7.bollUpPx >= 100 && before7.railPx >= 60, `up=${before7.bollUpPx} rail=${before7.railPx}`);
  await page.evaluate(() => {
    const body = document.querySelector('.chart-kline .chart-body');
    if (body) body.style.display = 'none';      // 模拟"容器不可见"导致 clientWidth = 0
    window.dispatchEvent(new Event('resize'));
  });
  await sleep(1000);
  const zero = await read(page);
  await page.evaluate(() => {
    const body = document.querySelector('.chart-kline .chart-body');
    if (body) body.style.display = '';
    window.dispatchEvent(new Event('resize'));
  });
  await sleep(1600);
  const healed = await read(page);
  check('尺寸不可用时登记了「待补画」而不是画一块白', zero.pendingSize || zero.backingW === 0, `pending=${zero.pendingSize} W=${zero.backingW}`);
  check('尺寸恢复后自动补画，布林与导轨回来了', healed.bollUpPx >= 100 && healed.railPx >= 60, `up=${healed.bollUpPx} rail=${healed.railPx}`);
  check('自愈后不再残留待补画标记', !healed.pendingSize);

  /* ================= 【8】运行期异常 ================= */
  console.log('\n【8】运行期异常');
  const real = errors.filter((e) => !/Failed to fetch|Load failed|NetworkError|aborted|jsonp|timeout|超时/i.test(e));
  check('无脚本级异常', real.length === 0, real.join(' | '));

  console.log(`\n通过 ${pass} 项，失败 ${fail} 项`);
  if (failures.length) { console.log('\n失败明细：'); failures.forEach((f) => console.log('  · ' + f)); }
  console.log(`截图：_shots/${SHOT}*.png`);
  await browser.close();
  if (serverInfo) serverInfo.srv.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
