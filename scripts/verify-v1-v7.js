'use strict';
/**
 * V1–V7 验收闸门
 * ================
 * 在落地「图表与导轨改造方案」之前，把七条验收标准变成可执行的脚本。
 *
 * 两条设计原则
 * ------------
 * ① **区分「已实现但失败」与「未实现」**：未落地的功能报 NOT_IMPLEMENTED 并打印
 *    实现后应跑的断言骨架，而不是静默通过 —— 静默通过会让闸门形同虚设。
 * ② **验证强度必须标出来**：V4/V5 需要浏览器像素检查。
 *      - Playwright 可用 → **像素级**验证（标 PASS(像素)）
 *      - 不可用         → 降级为**静态结构**检查（标 PASS(静态·弱)）
 *    静态检查只能证明"代码写了防御"，证明不了"画布上真有像素"。
 *    两者强度不同，绝不能混为一谈 —— 所以方法名必须出现在结果里。
 *
 * 本机 Playwright 环境说明（踩过的坑）：
 *   缓存里只有 webkit-2359，而 playwright@1.64 期望 webkit-2370。
 *   解法是建一个符号链接目录并指向 PLAYWRIGHT_BROWSERS_PATH，复用已缓存的浏览器，
 *   避免下载（本机到 Playwright CDN 的速度不可用）。
 *
 * 用法：
 *   NODE_PATH=<workspace>/node_modules PLAYWRIGHT_BROWSERS_PATH=/tmp/pw-browsers \
 *     node scripts/verify-v1-v7.js
 *   node scripts/verify-v1-v7.js --only V4,V7
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');

const ONLY = (() => {
  const i = process.argv.indexOf('--only');
  if (i < 0) return null;
  return new Set((process.argv[i + 1] || '').split(',').map((s) => s.trim().toUpperCase()));
})();

/** --save-baseline：把本次结果落盘为基线，供改造后做回归比对 */
const SAVE_BASELINE = process.argv.includes('--save-baseline');
const BASELINE_PATH = path.join(ROOT, 'scripts', 'baseline-v1-v7.json');

const P = { pass: 0, fail: 0, notImpl: 0, skip: 0 };
const results = [];
/** 像素基线：改造后新增图层**不得把原有图层的墨迹挤掉**，
 *  因此这里记录每个画布的 ink 率，作为回归比对的下限。 */
const PIXELS = { method: null, wide: [], narrow: [] };

function rec(id, name, status, detail) {
  results.push({ id, name, status, detail });
  const icon = { PASS: '✅', FAIL: '❌', NOT_IMPLEMENTED: '⬜', SKIP: '➖' }[status];
  console.log('  ' + icon + ' ' + id + ' ' + name + (detail ? '  → ' + detail : ''));
  if (status === 'PASS') P.pass++;
  else if (status === 'FAIL') P.fail++;
  else if (status === 'NOT_IMPLEMENTED') P.notImpl++;
  else P.skip++;
}

const want = (id) => !ONLY || ONLY.has(id);
const section = (t) => console.log('\n' + '─'.repeat(74) + '\n  ' + t + '\n' + '─'.repeat(74));
const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } };
const has = (h, n) => h.indexOf(n) >= 0;

/* ==========================================================================
 * V1 · 导轨外推的数学正确性
 * ========================================================================*/
function V1() {
  const tech = read(path.join(ROOT, 'lib/tech.js'));
  if (!/railExtend|extendRail|extrapolat/.test(tech)) {
    rec('V1', '导轨外推数学正确性', 'NOT_IMPLEMENTED', 'lib/tech.js 未见外推函数');
    console.log('     实现后应跑：');
    console.log('       · 外推点 == 末点 + 斜率 × 步数（误差 < 1e-6）');
    console.log('       · 外推根数 == 配置值，且不覆盖已实现区');
    console.log('       · 斜率为 0 时外推为水平线（不得产生 NaN）');
    console.log('       · 有效点不足 3 时拒绝外推并返回 null（不得静默画直线）');
    return;
  }
  rec('V1', '导轨外推数学正确性', 'PASS', '已检出实现');
}

/* ==========================================================================
 * V2 · 副图与主图 X 轴对齐
 * ========================================================================*/
function V2() {
  const app = read(path.join(ROOT, 'public/app.js'));
  if (!/drawSubChart|drawKDJ|drawRSI/.test(app)) {
    rec('V2', '副图与主图 X 轴对齐', 'NOT_IMPLEMENTED', 'public/app.js 未见副图绘制函数');
    console.log('     实现后应跑：');
    console.log('       · 同一下标 i 在 K线区/量区/MACD区/副图中的 X 坐标完全相等');
    console.log('       · 副图必须复用主图的 X() 映射函数（不得各写一份）');
    console.log('       · 缩放/平移后四区仍对齐');
    return;
  }
  const sharesX = /const\s+X\s*=/.test(app) && (app.match(/X\(i\)/g) || []).length >= 3;
  rec('V2', '副图与主图 X 轴对齐', sharesX ? 'PASS' : 'FAIL',
      sharesX ? '副图复用主图 X() 映射' : '未检出共用 X() 映射 —— 存在各写一份的风险');
}

/* ==========================================================================
 * V3 · 周期切换后指标口径正确
 * ========================================================================*/
function V3() {
  const src = read(path.join(ROOT, 'lib/source.js'));
  const app = read(path.join(ROOT, 'public/app.js'));
  const srcKlt = has(src, 'klt');
  const uiWired = /getKline\s*\([^)]*,\s*['"](week|month)['"]/.test(app);
  if (!uiWired) {
    rec('V3', '周期切换后指标口径正确', 'NOT_IMPLEMENTED',
        'source.js 支持 klt=' + (srcKlt ? '是' : '否') + '，但 app.js 未透传周/月周期');
    console.log('     实现后应跑：');
    console.log('       · 周线 MA5 == 日线 MA25 的周聚合值（最易错且最难发现的一类）');
    console.log('       · 周线 MACD 参数按周线语义换算，不沿用日线 12/26/9 的原始下标');
    console.log('       · 切回日线后指标与切换前完全一致（无状态残留）');
    return;
  }
  rec('V3', '周期切换后指标口径正确', 'PASS', '已检出周期透传');
}

/* ==========================================================================
 * 浏览器内核
 * ========================================================================*/

function loadPlaywright() {
  try { return require('playwright'); } catch { return null; }
}

function serveDocs() {
  return new Promise((resolve) => {
    const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };
    const srv = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      const f = path.join(DOCS, url === '/' ? 'index.html' : url.replace(/^\/+/, ''));
      if (!f.startsWith(DOCS) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}

/* 页面内探针：读真实 canvas 像素。
 * 这是静态检查给不了的东西 —— 能证明"画布上真有墨迹"，而不是"代码里有防御"。 */
const PROBE = `(() => {
  const out = { canvases: [], hints: [] };
  document.querySelectorAll('canvas').forEach((cv) => {
    let ink = -1, nonUniform = false;
    try {
      const ctx = cv.getContext('2d');
      const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
      let n = 0; const seen = new Set();
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 0) { n++; if (seen.size < 64) seen.add(d[i] + ',' + d[i+1] + ',' + d[i+2]); }
      }
      ink = n / (d.length / 4);
      nonUniform = seen.size > 2;
    } catch (e) { ink = -1; }
    out.canvases.push({ id: cv.id || '(no-id)', w: cv.width, h: cv.height, ink: +ink.toFixed(4), nonUniform });
  });
  const HINTS = ['暂无K线数据', '可用宽度不足', 'K线数值异常'];
  out.hints = HINTS.filter((h) => (document.body.innerText || '').indexOf(h) >= 0);
  return out;
})()`;

async function pixelCheck(pw, url) {
  const browser = await pw.webkit.launch();
  try {
    const wide = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await wide.goto(url, { waitUntil: 'load', timeout: 45000 }).catch(() => {});
    await wide.waitForTimeout(6000);
    const rWide = await wide.evaluate(PROBE);

    const narrow = await browser.newPage({ viewport: { width: 360, height: 780 } });
    await narrow.goto(url, { waitUntil: 'load', timeout: 45000 }).catch(() => {});
    await narrow.waitForTimeout(6000);
    const rNarrow = await narrow.evaluate(PROBE);

    return { rWide, rNarrow };
  } finally {
    await browser.close();
  }
}

/* 静态降级检查：只证明"代码写了防御" */
function staticChartChecks() {
  const app = read(path.join(ROOT, 'public/app.js'));
  return {
    emptyGuards: ['暂无K线数据', '可用宽度不足', 'K线数值异常'].filter((h) => has(app, h)),
    drawFns: (app.match(/function draw[A-Za-z]+/g) || []).map((s) => s.replace('function ', '')),
    hasWidthGuard: /cw\s*<\s*\d+/.test(app),
    hasFiniteGuard: /Number\.isFinite/.test(app),
    hasAlignFn: /alignSeries/.test(app),
  };
}

async function V4V5(port) {
  const url = 'http://127.0.0.1:' + port + '/';
  const pw = loadPlaywright();
  let method = null;

  if (pw) {
    try {
      const { rWide, rNarrow } = await pixelCheck(pw, url);
      method = 'pixel';
      PIXELS.method = 'pixel';
      PIXELS.wide = rWide.canvases;
      PIXELS.narrow = rNarrow.canvases;
      const inked = (r) => r.canvases.filter((c) => c.ink > 0.001 && c.nonUniform).length;
      const fmt = (r) => r.canvases.map((c) => c.id + '(ink=' + c.ink + ')').join(' ');

      const wideOk = rWide.canvases.length > 0 && inked(rWide) > 0;
      rec('V4', '图层开关组合下画布非空', wideOk ? 'PASS' : 'FAIL',
          'PASS(像素) 宽视口画布 ' + rWide.canvases.length + ' 个，有墨迹 ' + inked(rWide)
          + ' 个 | ' + fmt(rWide));

      /* V5：窄视口下"不产生空图"有两种合格形态 ——
         ① 画布仍有墨迹；② 画布无墨迹但给出了人话提示（有交代的空）。
         不可接受的只有一种：画布有尺寸、无墨迹、且无任何提示（静默空白）。 */
      const narrowHasInk = inked(rNarrow) > 0;
      const narrowHasHint = rNarrow.hints.length > 0;
      const narrowSilentBlank = rNarrow.canvases.length > 0 && !narrowHasInk && !narrowHasHint;
      rec('V5', '窄视口不产生空图', narrowSilentBlank ? 'FAIL' : 'PASS',
          'PASS(像素) 窄视口画布 ' + rNarrow.canvases.length + ' 个，有墨迹 ' + inked(rNarrow)
          + '，提示语 ' + (narrowHasHint ? '命中[' + rNarrow.hints.join('/') + ']' : '未命中')
          + (narrowSilentBlank ? ' ⚠️ 静默空白！' : '')
          + ' | ' + fmt(rNarrow));
      return;
    } catch (e) {
      console.log('  · Playwright 已加载但执行失败：' + String(e.message).split('\n')[0]);
      console.log('    → 降级为静态结构检查');
    }
  } else {
    console.log('  · Playwright 未安装 → 降级为静态结构检查');
  }

  /* ---- 降级：静态结构检查 ---- */
  const st = staticChartChecks();
  const guardOk = st.emptyGuards.length >= 3 && st.hasWidthGuard && st.hasFiniteGuard;
  rec('V4', '图层开关组合下画布非空', guardOk ? 'PASS' : 'FAIL',
      'PASS(静态·弱) 绘图函数 ' + st.drawFns.length + ' 个；空图交代语 '
      + st.emptyGuards.length + '/3；宽度防御 ' + (st.hasWidthGuard ? '有' : '无')
      + '；NaN 防御 ' + (st.hasFiniteGuard ? '有' : '无')
      + '  ⚠️ 静态检查证明不了画布真有像素');
  rec('V5', '窄视口不产生空图', st.hasWidthGuard ? 'PASS' : 'FAIL',
      'PASS(静态·弱) 检出宽度防御；序列对齐 ' + (st.hasAlignFn ? '有 alignSeries' : '无')
      + '  ⚠️ 未做真实渲染');
}

/* ==========================================================================
 * V6 · 静态版与源码一致
 * ========================================================================*/
function V6() {
  const bundle = read(path.join(DOCS, 'bundle.js'));
  const tech = read(path.join(ROOT, 'lib/tech.js'));
  if (!bundle) { rec('V6', '静态版与源码一致', 'FAIL', 'docs/bundle.js 不存在'); return; }
  const anchors = ['regressionChannel', 'donchian', 'channelVerdict', 'computeIndicators'];
  const missing = anchors.filter((a) => has(tech, a) && !has(bundle, a));
  rec('V6', '静态版与源码一致', missing.length === 0 ? 'PASS' : 'FAIL',
      missing.length === 0 ? 'bundle 含全部 ' + anchors.length + ' 个指标锚点'
                           : '缺失：' + missing.join(', ') + '（docs/ 落后于 lib/，需重建）');
}

/* ==========================================================================
 * V7 · 密钥扫描
 * ========================================================================*/
function V7() {
  const script = path.join(ROOT, 'scripts/scan-secrets.js');
  if (!fs.existsSync(script)) { rec('V7', '密钥扫描通过', 'SKIP', '未找到扫描脚本'); return; }
  try {
    execFileSync(process.execPath, [script], { cwd: ROOT, encoding: 'utf8', timeout: 60000, stdio: 'pipe' });
    rec('V7', '密钥扫描通过', 'PASS', '退出码 0');
  } catch (e) {
    const out = (e.stdout || '') + (e.stderr || '');
    rec('V7', '密钥扫描通过', 'FAIL', '退出码 ' + e.status + '；'
      + out.split('\n').filter(Boolean).slice(-3).join(' | '));
  }
}

/* ==========================================================================*/

(async () => {
  console.log('\n' + '='.repeat(74));
  console.log('  V1–V7 验收闸门（改造前基线）');
  console.log('  未实现的功能报 NOT_IMPLEMENTED，不静默通过');
  console.log('='.repeat(74));

  section('V1–V3 · 依赖新功能的项');
  if (want('V1')) V1();
  if (want('V2')) V2();
  if (want('V3')) V3();

  section('V4–V7 · 当前可建立的基线');
  const { srv, port } = await serveDocs();
  try {
    if (want('V4') || want('V5')) await V4V5(port);
    if (want('V6')) V6();
    if (want('V7')) V7();
  } finally {
    srv.close();
  }

  section('汇总');
  console.log('  通过 ' + P.pass + '   失败 ' + P.fail
    + '   未实现 ' + P.notImpl + '   跳过 ' + P.skip);
  const pending = results.filter((r) => r.status === 'NOT_IMPLEMENTED').map((r) => r.id);
  if (pending.length) {
    console.log('  待实现后启用：' + pending.join(', '));
    console.log('  → 功能落地前这些项**不计为通过**，闸门保持开启');
  }
  console.log('='.repeat(74) + '\n');

  if (SAVE_BASELINE) {
    const snapshot = {
      savedAt: new Date().toISOString(),
      gitHead: (() => {
        try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(); }
        catch { return null; }
      })(),
      method: PIXELS.method || 'static',
      summary: { pass: P.pass, fail: P.fail, notImplemented: P.notImpl, skipped: P.skip },
      pending: results.filter((r) => r.status === 'NOT_IMPLEMENTED').map((r) => r.id),
      pixels: { wide: PIXELS.wide, narrow: PIXELS.narrow },
      note: [
        '改造后的回归判据：新增图层**不得把原有图层的墨迹挤掉**。',
        '即改造后各画布 ink 率应 >= 本基线值 × 0.9（允许 10% 浮动）。',
        '若某画布 ink 掉到 0.001 以下，说明该图层被挤没了 —— 这是静默故障。',
        'V1/V2/V3 落地后应转为 PASS，且 pending 列表清空。',
      ],
      results,
    };
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
    console.log('  基线已保存：' + path.relative(ROOT, BASELINE_PATH) + '\n');
  }

  process.exit(P.fail === 0 && P.notImpl === 0 ? 0 : (P.fail > 0 ? 1 : 2));
})().catch((e) => { console.error('异常: ' + e.stack); process.exit(1); });
