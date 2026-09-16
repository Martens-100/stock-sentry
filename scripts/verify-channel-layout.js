'use strict';
/**
 * 轨道研判卡片「横屏分栏布局」闸门 —— 真 WebKit 几何断言。
 *
 * 为什么需要它（这张卡片此前到底坏在哪）：
 *   ① 分栏规则是 `@media (max-width:860px){ .channel-grid{ 1fr !important } }`，
 *      只按宽度判断 → 852×393 横屏手机、820px 平板也被压成一列。
 *      每个格子 790px 宽里只有百来字，**右侧约 590px 是空白**（内容全挤在左端）。
 *   ② `.ch-zone-row` 是 flex+wrap，而移动端覆盖块里的 `.ch-advice{min-width:0}`
 *      允许建议缩到 min-content → 393px 竖屏实测建议只剩 87px 宽 / 286px 高，
 *      一句「方向未选择…」被压成一条竖缝（每行 3 个字）。
 *   ③ 三段式轨道行在窄屏只给轨道条留下 161px，刻度挤成一团。
 *
 * 断言口径：横向空间必须被真的用起来（列数、行内文本占比），且不得塌成竖缝。
 * 载荷用**确定性 fixture 注入**（借 SentryStatic.handle 这一层），
 * 因此不受行情接口可用性影响，5 个视口的结果可复现。
 * 真实数据链路的表现由 verify-chart-layers.js（62 项）覆盖。
 *
 * 用法：
 *   NODE_PATH=<node workspace>/node_modules node scripts/verify-channel-layout.js
 *   NODE_PATH=... node scripts/verify-channel-layout.js https://<线上地址>/
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { webkit } = require('playwright');

const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const SHOTS = path.join(ROOT, '_shots');
const REMOTE_URL = process.argv.slice(2).find((a) => /^https?:\/\//.test(a)) || null;
const TAG = REMOTE_URL ? 'live' : 'local';
const ONLY = process.argv.slice(2).find((a) => a.startsWith('--only='))?.slice(7) || null;

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      const file = path.join(DOCS, url === '/' ? 'index.html' : url.replace(/^\/+/, ''));
      if (!file.startsWith(DOCS) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}

/* ---------------------------------------------------------------- 断言基线
   每个视口给出预期列数与下限/上限。数值取自本次修复前后的实测对照：
     852×393  卡高 652 → 407   track 620   advice 531×62
     820×1180 卡高 652 → 443   track 588   advice 499×62
     393×852  advice 87×286 → 331×124     track 161 → 327
   上限留了余量，避免字体度量差异造成假红。 */
const VIEWPORTS = [
  {
    name: '手机竖屏 393×852', w: 393, h: 852, mobile: true,
    cols: 1, sameRow: false, adviceMinW: 250, adviceMaxH: 200, trackMinW: 250, maxCardH: 1000,
  },
  {
    name: '手机横屏 852×393', w: 852, h: 393, mobile: true,
    cols: 3, sameRow: true, adviceMinW: 300, adviceMaxH: 120, trackMinW: 400, maxCardH: 520,
  },
  {
    name: '平板竖屏 820×1180', w: 820, h: 1180, mobile: true,
    cols: 3, sameRow: true, adviceMinW: 300, adviceMaxH: 120, trackMinW: 400, maxCardH: 560,
  },
  {
    name: '笔记本 1280×900', w: 1280, h: 900, mobile: false,
    cols: 3, sameRow: true, adviceMinW: 300, adviceMaxH: 140, trackMinW: 500, maxCardH: 560,
  },
  {
    name: '宽屏 1680×950', w: 1680, h: 950, mobile: false,
    cols: 3, sameRow: true, adviceMinW: 300, adviceMaxH: 140, trackMinW: 500, maxCardH: 560,
  },
];

/* 确定性载荷：文案与数值取用户反馈的那一组（下降导轨 · 通道中部观望区 / 15.49 / 12.74），
   这样截图与描述能一一对上。字段类型必须是 number ——
   railRow 用 `hi > lo` 判有效，字符串会按字典序比较从而**静默丢行**。 */
const FIXTURE = {
  zone: '下降导轨 · 通道中部观望区',
  color: '#fb8c00',
  advice: '价格位于通道中上部，方向未选择；建议等待触及通道上沿（15.49）或下沿（12.74）再行动，中部不追不杀。',
  boll: { up: 15.49, mid: 14.12, dn: 12.74 },
  bollLabel: '带内中上位置',
  railDirLabel: '下降导轨',
  railPosLabel: '通道中上部',
  bollInfo: { pctB: 0.63, bandwidthPct: 8.18, bandwidthPctile: 31, stateLabel: '收口（变盘临近）' },
  rails: { up: 15.49, mid: 14.12, dn: 12.74, bars: 60, k: 2, slope20Pct: -5.04, widthPct: 17.82, pctChan: 0.48, reliable: true },
  donchian: { upper: 15.49, lower: 12.4, mid: 13.95, pct: 18.4 },
  price: 14.1,
};

/* 把确定性载荷挂到 ind 上。**只覆盖这一个卡片的输入**，
   其余字段仍用真实响应的值，避免把别的卡片一起带偏。 */
const injectFixture = (fx) => (page) => page.evaluate((FX) => {
  const S = window.SentryStatic;
  if (!S || !S.handle) return 'no SentryStatic';
  if (!S.__orig) S.__orig = S.handle.bind(S);   // 只记一次原函数，避免补丁叠链
  const orig = S.__orig;
  S.handle = async (p, o) => {
    const res = await orig(p, o);
    if (p.indexOf('/api/analyze') === 0 && res && res.ok && res.data && res.data.ind) {
      const ind = res.data.ind;
      ind.channelVerdict = FX;
      ind.price = FX.price;
      ind.bollInfo = FX.bollInfo;
      ind.rails = FX.rails;
      ind.donchian = FX.donchian;
    }
    return res;
  };
  return 'ok';
}, fx);

const PROBE = () => {
  const q = (s) => document.querySelector(s);
  const qa = (s) => [...document.querySelectorAll(s)];
  const rect = (el) => (el ? el.getBoundingClientRect() : null);
  const box = (el) => { const b = rect(el); return b ? { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) } : null; };
  /* 量「内容自然宽度」= 最长那一行真正需要多宽。
     不能用 Range.getClientRects()：它覆盖含 inline 子元素（<b>/<em>）的内容时
     会把 rect 按 box 片段切碎，实测只量到 83px，而那一行实际是 190px —— 会得出假结论。
     做法：克隆一份、white-space:nowrap + width:max-content 挂在屏外，
     <br> 仍然分段，max-content 取的就是最宽那段。 */
  const naturalW = (el) => {
    if (!el || !el.parentNode) return 0;
    const c = el.cloneNode(true);
    c.style.cssText = 'position:absolute;left:-9999px;top:0;white-space:nowrap;width:max-content;max-width:none;visibility:hidden';
    el.parentNode.appendChild(c);
    const w = c.getBoundingClientRect().width;
    c.remove();
    return +w.toFixed(1);
  };

  const card = q('.channel-card');
  const grid = q('.channel-grid');
  const items = qa('.ch-item');
  const rows = qa('#railViz .rv-row');
  const segs = qa('#chAdvice .ad-seg');
  const adv = q('#chAdvice');
  const zone = q('#chZone');
  const cols = grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').filter((v) => parseFloat(v) > 0) : [];

  return {
    vp: { w: innerWidth, h: innerHeight },
    card: box(card),
    gridW: grid ? +rect(grid).width.toFixed(1) : 0,
    colCount: cols.length,
    itemBoxes: items.map(box),
    itemNaturalW: items.map((e) => naturalW(e.querySelector('.ch-vals'))),
    sameRow: items.length > 1
      ? items.every((e) => Math.abs(rect(e).y - rect(items[0]).y) < 2)
      : false,
    zone: box(zone), zoneText: zone ? zone.textContent.trim() : '',
    advice: box(adv), adviceText: adv ? adv.textContent.replace(/\s+/g, ' ').trim() : '',
    adviceSegs: segs.map((s) => s.textContent.trim()),
    adviceBorderColor: adv ? getComputedStyle(adv).borderLeftColor : '',
    rowCount: rows.length,
    rowFilled: rows.filter((r) => !r.classList.contains('rv-row-empty')).length,
    trackW: rows.map((r) => { const b = rect(r.querySelector('.rv-track')); return b ? +b.width.toFixed(1) : 0; }),
    trackH: rows.map((r) => { const b = rect(r.querySelector('.rv-track')); return b ? +b.height.toFixed(1) : 0; }),
    rowVal: rows.map((r) => (r.querySelector('.rv-val') || {}).textContent || ''),
    overflowX: document.documentElement.scrollWidth > innerWidth + 1,
    docScrollW: document.documentElement.scrollWidth,
    buildTag: (() => { const t = q('#buildTag'); return t ? t.textContent.trim() : ''; })(),
    errs: [],
  };
};

let pass = 0; let fail = 0; const failures = [];
function check(name, ok, detail) {
  if (ok) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; failures.push(name); console.log(`  ❌ ${name}${detail ? `   ${detail}` : ''}`); }
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const { srv, port } = REMOTE_URL ? { srv: null, port: 0 } : await serve();
  const base = REMOTE_URL || `http://127.0.0.1:${port}/`;
  const browser = await webkit.launch();
  console.log(`\n目标：${REMOTE_URL || '本地 docs/（临时 http 服务）'}\n`);

  for (const vp of VIEWPORTS) {
    if (ONLY && !vp.name.includes(ONLY)) continue;
    console.log(`【${vp.name}】`);
    const ctx = await browser.newContext({
      viewport: { width: vp.w, height: vp.h },
      deviceScaleFactor: 2,
      isMobile: vp.mobile,
      hasTouch: vp.mobile,
      userAgent: vp.mobile
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
        : undefined,
    });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    const inj = await injectFixture(FIXTURE)(page);
    check('能够注入确定性载荷（不依赖行情接口可用性）', inj === 'ok', `注入返回 ${inj}`);
    /* 注入后必须触发一次**真正的重新分析**。
       点刷新按钮不行：refreshAll 只重渲染手里的旧数据，不会重新走 /api/analyze，
       补丁根本不会被调用到（这一点在 verify-chart-layers 里踩过）。
       切到另一只标的再切回来，才是真实的分析路径。 */
    await page.evaluate(() => {
      const items = [...document.querySelectorAll('.wl-item')];
      if (items.length > 1) items[1].click();
    });
    await page.waitForTimeout(1800);
    await page.evaluate(() => {
      const items = [...document.querySelectorAll('.wl-item')];
      if (items.length > 0) items[0].click();
    });
    await page.waitForTimeout(2600);
    await page.evaluate(() => document.querySelector('.channel-card')?.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);

    const g = await page.evaluate(PROBE);
    g.errs = errs;

    /* 前置条件：数据得在位，否则几何断言没有意义。
       若真实行情接口不可用导致 ind 缺失，这里会明确指出"是数据没来"而不是误报布局错。 */
    const ready = g.itemBoxes.length === 3 && g.rowCount === 3;
    check('前置：三块指标与三行轨道都已渲染', ready,
      `items=${g.itemBoxes.length} rows=${g.rowCount}（若为 0/不足，多半是行情接口不可用，不是布局问题）`);

    if (ready) {
      check(`数据块分栏列数 = ${vp.cols}（按可用宽度自适应，而非一刀切竖排）`,
        g.colCount === vp.cols, `实测 ${g.colCount} 列：${g.itemBoxes.map((b) => b.w).join(' / ')}px`);
      check(vp.sameRow ? '三块指标排在同一行（横向铺开）' : '三块指标单列纵向排布（窄屏容纳不下三列）',
        vp.sameRow ? g.sameRow === true : g.sameRow === false, `sameRow=${g.sameRow}`);
      check(`卡片高度 ≤ ${vp.maxCardH}px`, g.card.h <= vp.maxCardH, `实测 ${g.card.h}px`);

      if (vp.sameRow) {
        const maxItemW = Math.max(...g.itemBoxes.map((b) => b.w));
        check('没有把数据块拉成整行宽度（那正是「右侧大片空白」的成因）',
          maxItemW < g.gridW * 0.6, `最宽一块 ${maxItemW}px，容器 ${g.gridW}px`);
        const sumW = +g.itemBoxes.reduce((a, b) => a + b.w, 0).toFixed(1);
        check('列宽合计铺满容器（≥ 90%，横向空间没有被浪费）',
          sumW / g.gridW >= 0.9, `列宽合计 ${sumW}px / 容器 ${g.gridW}px = ${(sumW / g.gridW).toFixed(3)}`);
      }

      /* 「横向空间是否被用起来」的量化口径：**最长内容行** vs **最宽格子**的占比。
         修复前横屏 190/790 ≈ 0.24（右侧约 76% 空着）；修复后 ≈ 190/257 ≈ 0.74。
         这里取 max 而不是逐块判断 —— 唐奇安那一块内容天然就短（只有三行短句），
         要求「每一块都填满」会误报（第一版就是这么假红的）。 */
      const maxNatural = Math.max(...g.itemNaturalW);
      const maxColW = Math.max(...g.itemBoxes.map((b) => b.w));
      check('最长内容行占格宽 ≥ 0.35（格子没有被拉得远超其内容）',
        maxNatural / maxColW >= 0.35,
        `内容 ${maxNatural}px / 格宽 ${maxColW}px = ${(maxNatural / maxColW).toFixed(2)}`);

      check(`建议区宽度 ≥ ${vp.adviceMinW}px（不再被 nowrap 徽章挤成竖缝）`,
        g.advice.w >= vp.adviceMinW, `实测 ${g.advice.w}px × ${g.advice.h}px`);
      check(`建议区高度 ≤ ${vp.adviceMaxH}px（竖缝会远高于此值：修复前 393 竖屏是 286px）`,
        g.advice.h <= vp.adviceMaxH, `实测 ${g.advice.h}px`);

      check('「方向未选择」独立成句渲染（观望提示因此能被逐行读到）',
        g.adviceSegs.some((s) => s.indexOf('未选择') >= 0),
        `句段=${JSON.stringify(g.adviceSegs)}`);
      check('建议区句段数 ≥ 3（按标点拆分生效）', g.adviceSegs.length >= 3, `实测 ${g.adviceSegs.length} 段`);
      check('观望结论徽章在位且有内容', g.zoneText.length > 0 && g.zone.h > 0, `"${g.zoneText}"`);
      check('观望徽章保持胶囊尺寸（单列时不被拉成整行横幅）',
        g.zone.w <= 340, `实测 ${g.zone.w}px × ${g.zone.h}px`);

      if (vp.sameRow) {
        const noOverlap = g.zone.x + g.zone.w <= g.advice.x + 1;
        check('同排时徽章与建议不重叠（两列网格）', noOverlap,
          `zone 右缘 ${(g.zone.x + g.zone.w).toFixed(0)} vs advice 左缘 ${g.advice.x}`);
      }

      check(`轨道条宽度 ≥ ${vp.trackMinW}px（窄屏两段式让轨道占满整宽）`,
        g.trackW.every((w) => w >= vp.trackMinW), `实测 ${g.trackW.join(', ')}px`);
      check('三行轨道都画出了真实区间（非「不可用」占位）', g.rowFilled === 3,
        `filled=${g.rowFilled} val=${JSON.stringify(g.rowVal.map((s) => s.slice(0, 14)))}`);
    }

    check('无横向溢出', g.overflowX === false, `docScrollW=${g.docScrollW} vp=${vp.w}`);
    check('无脚本级异常', errs.length === 0, errs.join(' | '));

    await page.evaluate(() => document.querySelector('.channel-card')?.scrollIntoView({ block: 'start' }));
    /* 截图前把吸顶侧栏设为 visibility:hidden —— 用 visibility 而不是 display，
       占位仍在、卡片几何不变；否则移动端吸顶的胶囊条会盖住卡片顶部，
       截出来的图正好看不到徽章长什么样（第一版截图就是这样被骗过去的）。 */
    await page.evaluate(() => {
      document.querySelectorAll('.sidebar,.topbar').forEach((e) => { e.style.visibility = 'hidden'; });
    });
    await page.waitForTimeout(150);
    const card = await page.$('.channel-card');
    if (card) await card.screenshot({ path: path.join(SHOTS, `channel-${vp.w}x${vp.h}-${TAG}.png`) });
    console.log(`   截图 → _shots/channel-${vp.w}x${vp.h}-${TAG}.png\n`);
    await ctx.close();
  }

  await browser.close();
  if (srv) srv.close();
  console.log(`通过 ${pass} 项，失败 ${fail} 项`);
  if (fail) { console.log(`失败项：${failures.join('；')}`); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });
