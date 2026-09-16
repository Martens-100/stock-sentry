'use strict';
/**
 * 方案 E 的真机引擎验证 —— Playwright 的 **WebKit**（Safari 内核）+ iPhone 视口，
 * 打开本地构建产物 docs/，逐条断言布局几何与交互行为。
 *
 * 为什么必须是 WebKit + 真视口，而不是 jsdom：
 *   jsdom 不算布局、不做媒体查询、没有 100dvh / env(safe-area-inset-bottom)、
 *   也不执行 sticky 与 position:fixed 的层叠。方案 E 改的恰恰全是这些东西 ——
 *   「胶囊条是不是真的吸顶」「清单层是不是真的全屏」「K 线是不是真的折叠了」，
 *   只有在真布局引擎里才有答案。Safari 与 Chrome 的差异点（dvh、安全区、触控目标）
 *   也只有在 WebKit 里才暴露得出来。
 *
 * 用法：
 *   NODE_PATH=<workspace>/node_modules node scripts/verify-planE-webkit.js
 *   NODE_PATH=... node scripts/verify-planE-webkit.js --block-fetch
 *     --block-fetch 只放行 <script>、拦掉 fetch/XHR，用来在真 WebKit 上
 *     验证「切股走 JSONP 兜底」这条链路在方案 E 的新交互下依然活。
 *   NODE_PATH=... node scripts/verify-planE-webkit.js --headed   看真实操作过程
 *   NODE_PATH=... node scripts/verify-planE-webkit.js --standalone
 *     改为验证交付用的单文件版 out/stock-sentry-standalone.html（用 file:// 打开）。
 *     这一份才是「当附件发给别人」的形态：file:// 下 fetch 会被浏览器禁止，
 *     取数只能靠 JSONP 兜底 —— 所以它是唯一能证明「离线单文件也能用」的姿势。
 *   NODE_PATH=... node scripts/verify-planE-webkit.js https://xxx.example.com/
 *     传一个 http(s) 地址：直接对**已部署的线上站点**跑同一套断言。
 *     这一步不能省 —— 本地绿只证明「源码是对的」，线上绿才证明「发出去的那份是对的」
 *     （构建产物、CDN、指纹、路径前缀，任何一环都能让两边行为不同）。
 *
 * 截图输出到 _shots/planE-*.png（_shots 与 out/ 都在 .gitignore 里，不入库）。
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { webkit, devices } = require('playwright');

const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const SHOTS = path.join(ROOT, '_shots');
const BLOCK_FETCH = process.argv.includes('--block-fetch');
const HEADED = process.argv.includes('--headed');
const STANDALONE = process.argv.includes('--standalone');
/** 第一个非 --flag 参数：给了就当作线上地址，直接验部署产物 */
const REMOTE_URL = process.argv.slice(2).find((a) => /^https?:\/\//.test(a)) || null;
const SHOT = REMOTE_URL ? 'planE-live-' : STANDALONE ? 'planE-standalone-' : 'planE-';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml'
};

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; failures.push(name + (extra ? ` → ${extra}` : '')); console.log(`  ❌ ${name}${extra ? ' → ' + extra : ''}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- 本地静态服务：产物必须从 http 取，不能 file:// ----------------
   file:// 下 fetch 会被浏览器直接禁掉，JSONP 还能走 <script>，于是页面能跑但
   跑的是「兜底路径」，掩盖掉正常路径的问题。所以固定用 http 起一份。 */
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

/** 在页面里合成一次横滑。用普通 Event + 手工挂 touches —— 
    Playwright 的 touchscreen 只有 tap，没有 swipe；而我们的手势逻辑只读
    e.touches[0].clientX/clientY 与 e.changedTouches[0]，所以这样喂进去
    能真实走过「方向判定 → 阈值判定 → 换股」的每一行代码。
    这不是真手指，测的是手势数学，不是触摸链路 —— 后者由真机人工确认。 */
const swipeScript = (dir) => `(() => {
  const box = document.querySelector('.content');
  const r = box.getBoundingClientRect();
  const y = Math.round(r.top + Math.min(300, r.height / 2));
  const x0 = Math.round(r.left + r.width * (${dir} > 0 ? 0.25 : 0.75));
  const x1 = Math.round(r.left + r.width * (${dir} > 0 ? 0.75 : 0.25));
  const mk = (type, x) => {
    const e = new Event(type, { bubbles: true, cancelable: true });
    e.touches = [{ clientX: x, clientY: y }];
    e.changedTouches = [{ clientX: x, clientY: y }];
    return e;
  };
  box.dispatchEvent(mk('touchstart', x0));
  box.dispatchEvent(mk('touchmove', Math.round((x0 + x1) / 2)));
  box.dispatchEvent(mk('touchend', x1));
  return true;
})()`;

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });

  let srv = null;
  let URL;
  if (REMOTE_URL) {
    URL = REMOTE_URL;
    console.log(`\n线上站点（验部署产物，不是本地源码）：${URL}`);
  } else if (STANDALONE) {
    const file = path.join(ROOT, 'out', 'stock-sentry-standalone.html');
    if (!fs.existsSync(file)) { console.error('单文件版不存在，请先运行 node build-static.js'); process.exit(1); }
    URL = 'file://' + file;
    console.log(`\n单文件版（file:// 直开，取数只能走 JSONP 兜底）：${URL}`);
  } else {
    const started = await serve();
    srv = started.srv;
    URL = `http://127.0.0.1:${started.port}/`;
    console.log(`\n本地静态服务：${URL}（产物目录 docs/）`);
  }

  const browser = await webkit.launch({ headless: !HEADED });
  const ctx = await browser.newContext({ ...devices['iPhone 15'] });
  const page = await ctx.newPage();

  if (BLOCK_FETCH) {
    // 只拦 fetch/XHR，放行 <script src>：这正是广告拦截插件 / 隐私保护 / 部分企业代理
    // 的真实表现，也是 JSONP 兜底唯一能救命的封锁方式。
    await page.route('**://*.gtimg.cn/**', (route) => {
      const type = route.request().resourceType();
      if (type === 'script') return route.continue();
      return route.abort('failed');
    });
    console.log('（已启用 --block-fetch：拦 fetch/XHR 到 *.gtimg.cn，仅放行 <script>）');
  }

  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  /* ==================== 1. 移动端几何 ==================== */
  console.log('\n【1】移动端布局几何（iPhone 15 视口）');
  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });

  // 等首只标的落地（成功出名称 / 失败出诊断面板），两种都算「启动完成」
  await page.waitForFunction(() => {
    const g = document.querySelector('#emptyDiag');
    if (g && !g.hidden) return true;
    const n = document.querySelector('#sName');
    return n && n.textContent && n.textContent !== '—';
  }, { timeout: 90000 }).catch(() => {});

  const geom = await page.evaluate(() => {
    const cs = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { display: s.display, position: s.position, flexDirection: s.flexDirection,
        flexBasis: s.flexBasis, minHeight: s.minHeight, maxHeight: s.maxHeight,
        overflowX: s.overflowX, fontSize: s.fontSize, paddingBottom: s.paddingBottom,
        transform: s.transform, w: Math.round(r.width), h: Math.round(r.height),
        top: Math.round(r.top), bottom: Math.round(r.bottom) };
    };
    return {
      innerWidth: window.innerWidth,
      sidebar: cs('.sidebar'),
      topbar: cs('.topbar'),
      layout: cs('.layout'),
      watchlist: cs('.watchlist'),
      chip: cs('.watchlist .wl-item'),
      chipDel: cs('.watchlist .wl-item .wl-del'),
      chipAll: cs('#chipAll'),
      panel: cs('#allSheet'),
      minuteBody: cs('.chart-minute .chart-body'),
      addInput: cs('#addInput'),
      addBtn: cs('#addBtn'),
      content: cs('.content'),
      refreshAll: cs('#refreshAll'),
      monitorWrap: cs('#monitorTableWrap'),
      minuteOpen: document.querySelector('.chart-minute').classList.contains('open'),
      chipCount: document.querySelectorAll('.watchlist .wl-item').length,
      chipAllText: (document.querySelector('#chipAll') || {}).textContent || ''
    };
  });

  check('视口是移动端宽度（<=860px）', geom.innerWidth <= 860, `innerWidth=${geom.innerWidth}`);
  check('顶栏在移动端不再吸顶（position:static，让位给胶囊条）', geom.topbar.position === 'static', geom.topbar.position);
  check('侧栏变成顶部胶囊条（sticky 吸顶）', geom.sidebar.position === 'sticky', geom.sidebar.position);
  check('主布局改为纵向块级（不再左右分栏）', geom.layout.display === 'block', geom.layout.display);
  check('胶囊条横滑（flex-direction:row + overflow-x:auto）',
    geom.watchlist.flexDirection === 'row' && geom.watchlist.overflowX === 'auto',
    `${geom.watchlist.flexDirection} / ${geom.watchlist.overflowX}`);
  check('胶囊基准宽度 136px（原 132px，方案 E 加宽）', geom.chip.flexBasis === '136px', geom.chip.flexBasis);
  /* 必须验「实际渲染宽度」，不能只验 flex-basis：
     Safari 会按 min-width:auto（内容最小尺寸）把 flex:0 0 136px 的胶囊撑到 163px，
     而 computed flex-basis 依然是 136px —— 只验 flex-basis 会放过这个 bug。 */
  check('胶囊实际渲染宽度就是 136px（未被内容撑宽）', geom.chip.w === 136, `${geom.chip.w}px`);
  check('胶囊最小高度 64px（触控目标）', geom.chip.minHeight === '64px', geom.chip.minHeight);
  check('胶囊上的删除按钮已隐藏（避免与横滑手势打架）', geom.chipDel.display === 'none', geom.chipDel.display);
  check('「清单」入口可见且为 flex 布局', geom.chipAll.display === 'flex', geom.chipAll.display);
  check('「清单」入口固定在胶囊条右端（sticky right）', geom.chipAll.position === 'sticky', geom.chipAll.position);
  check('「清单」入口高度 >= 64px', geom.chipAll.h >= 64, `${geom.chipAll.h}px`);
  check('「清单」入口带自选数量', /清单\s*\d+/.test(geom.chipAllText), JSON.stringify(geom.chipAllText));
  check('分时图表默认折叠（max-height:0）', geom.minuteBody.maxHeight === '0px', geom.minuteBody.maxHeight);
  check('图表未被标记为展开', geom.minuteOpen === false);
  check('清单层保持挂载（display:flex，靠 transform 移出视口）', geom.panel.display === 'flex', geom.panel.display);
  check('清单层初始在视口之外', geom.panel.top >= geom.innerWidth, `top=${geom.panel.top}`);
  check('添加输入框字号 >= 16px（防 iOS 聚焦放大）', parseFloat(geom.addInput.fontSize) >= 16, geom.addInput.fontSize);
  check('「添加」按钮触控高度 >= 44px', geom.addBtn.h >= 44, `${geom.addBtn.h}px`);
  check('内容区底部留了 iPhone 安全区（>=46px）', parseFloat(geom.content.paddingBottom) >= 46, geom.content.paddingBottom);
  check('顶栏「立即刷新」在移动端收起（改由胶囊区承担）', geom.refreshAll.display === 'none', geom.refreshAll.display);
  check('监控清单（7 列表格）有独立横向滚动容器，不撑宽整页', geom.monitorWrap.overflowX === 'auto',
    geom.monitorWrap.overflowX);

  const overflow = await page.evaluate(() => {
    const iw = window.innerWidth;
    const blamed = [];
    document.querySelectorAll('body *').forEach((el) => {
      if (getComputedStyle(el).position === 'fixed') return;   // 固定层不该参与文档滚动宽度
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > iw + 1) {
        blamed.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${String(el.className || '').split(' ')[0]}(${Math.round(r.right)})`);
      }
    });
    return { sw: document.documentElement.scrollWidth, iw, blamed: blamed.slice(0, 5) };
  });
  check('页面无横向溢出（scrollWidth <= innerWidth）', overflow.sw <= overflow.iw + 1,
    `${overflow.sw} vs ${overflow.iw}${overflow.blamed.length ? ' ← 撑宽元素：' + overflow.blamed.join(', ') : ''}`);

  await page.screenshot({ path: path.join(SHOTS, SHOT + '1-mobile.png'), fullPage: false });

  /* ==================== 2. 胶囊横滑换股 ==================== */
  console.log('\n【2】胶囊横滑 + 点选换股');
  if (geom.chipCount >= 2) {
    const firstCode = await page.evaluate(() => document.querySelector('.watchlist .wl-item.active').dataset.code);
    await page.locator('.watchlist .wl-item').nth(1).click();
    await page.waitForFunction((c) => {
      const a = document.querySelector('.watchlist .wl-item.active');
      return a && a.dataset.code !== c;
    }, firstCode, { timeout: 30000 }).catch(() => {});
    const after = await page.evaluate(() => ({
      active: document.querySelector('.watchlist .wl-item.active').dataset.code,
      name: document.querySelector('#sName').textContent
    }));
    check('点第二个胶囊后高亮切换', after.active !== firstCode, `${firstCode} → ${after.active}`);
    check('详情区跟着换到新标的', !!(after.name && after.name !== '—'), JSON.stringify(after.name));

    // 横滑换股（合成触摸事件，走完整的手势判定逻辑）
    const beforeSwipe = await page.evaluate(() => document.querySelector('.watchlist .wl-item.active').dataset.code);
    await page.evaluate(swipeScript(-1));
    await sleep(1200);
    const afterSwipe = await page.evaluate(() => document.querySelector('.watchlist .wl-item.active').dataset.code);
    check('内容区向左横滑切换到下一只标的', afterSwipe !== beforeSwipe, `${beforeSwipe} → ${afterSwipe}`);

    // 图表区必须排除在换股手势之外，否则「拖着看 K 线」会变成换股
    await page.evaluate(() => { document.querySelector('.chart-minute').classList.add('open'); });
    const beforeChartSwipe = await page.evaluate(() => document.querySelector('.watchlist .wl-item.active').dataset.code);
    await page.evaluate(`(() => {
      const card = document.querySelector('.chart-minute');
      const r = card.getBoundingClientRect();
      const y = Math.round(r.top + 40), x0 = Math.round(r.left + r.width * 0.75), x1 = Math.round(r.left + r.width * 0.25);
      const mk = (type, x) => { const e = new Event(type, { bubbles: true, cancelable: true });
        e.touches = [{ clientX: x, clientY: y }]; e.changedTouches = [{ clientX: x, clientY: y }]; return e; };
      card.dispatchEvent(mk('touchstart', x0));
      card.dispatchEvent(mk('touchmove', Math.round((x0 + x1) / 2)));
      card.dispatchEvent(mk('touchend', x1));
    })()`);
    await sleep(600);
    const afterChartSwipe = await page.evaluate(() => document.querySelector('.watchlist .wl-item.active').dataset.code);
    check('在图表区横滑不会误触发换股', afterChartSwipe === beforeChartSwipe, `${beforeChartSwipe} → ${afterChartSwipe}`);
    await page.evaluate(() => { document.querySelector('.chart-minute').classList.remove('open'); });
  } else {
    check('自选股至少 2 只（否则无法验证换股）', false, `实际 ${geom.chipCount} 只`);
  }

  /* ==================== 3. 底部全屏清单 ==================== */
  console.log('\n【3】底部全屏清单（管理态）');
  await page.locator('#chipAll').click();
  await sleep(500);
  const opened = await page.evaluate(() => {
    const p = document.querySelector('#allSheet');
    const r = p.getBoundingClientRect();
    return {
      open: p.classList.contains('open'),
      top: Math.round(r.top), h: Math.round(r.height),
      vh: window.innerHeight,
      bodyOverflow: getComputedStyle(document.body).overflow,
      rows: document.querySelectorAll('#allList .al-row').length,
      cnt: (document.querySelector('#allCnt') || {}).textContent || '',
      maskOpacity: getComputedStyle(document.querySelector('#sheetMask')).opacity
    };
  });
  check('点「清单」后清单层打开', opened.open);
  check('清单层几乎占满屏高（>=90% 视口）', opened.h >= opened.vh * 0.9, `${opened.h} / ${opened.vh}`);
  check('清单层贴住视口顶部附近', opened.top <= opened.vh * 0.1, `top=${opened.top}`);
  check('背景遮罩已生效', parseFloat(opened.maskOpacity) > 0.2, opened.maskOpacity);
  check('打开时锁住页面滚动（body overflow:hidden）', opened.bodyOverflow === 'hidden', opened.bodyOverflow);
  check('清单列出了全部自选', opened.rows === geom.chipCount, `${opened.rows} vs ${geom.chipCount}`);
  check('清单头部显示数量统计', /\d+\s*只/.test(opened.cnt), JSON.stringify(opened.cnt));
  await page.screenshot({ path: path.join(SHOTS, SHOT + '2-sheet.png'), fullPage: false });

  // 排序
  const sorted = await page.evaluate(async () => {
    document.querySelector('#allSorts button[data-sort="code"]').click();
    await new Promise((r) => setTimeout(r, 200));
    const codes = [...document.querySelectorAll('#allList .al-main[data-code]')].map((e) => e.dataset.code);
    const active = document.querySelector('#allSorts button.active');
    return { codes, activeSort: active && active.getAttribute('data-sort') };
  });
  const asc = sorted.codes.slice().sort();
  check('按「代码」排序后升序正确', JSON.stringify(sorted.codes) === JSON.stringify(asc), sorted.codes.join(','));
  check('排序按钮高亮切到「代码」', sorted.activeSort === 'code', String(sorted.activeSort));

  // 本地筛选（#allSearch 只筛已添加的自选，不打接口）
  await page.fill('#allSearch', 'zzz-不存在');
  await sleep(300);
  const filtered = await page.evaluate(() => ({
    rows: document.querySelectorAll('#allList .al-row').length,
    empty: (document.querySelector('#allList .as-empty') || {}).textContent || ''
  }));
  check('筛选词无匹配时不显示任何行', filtered.rows === 0, `${filtered.rows}`);
  check('无匹配时给出空态提示', /没有匹配/.test(filtered.empty), JSON.stringify(filtered.empty));

  await page.evaluate(() => {
    const i = document.querySelector('#allSearch'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#allSorts button[data-sort="none"]').click();
  });
  await sleep(300);
  const restored = await page.evaluate(() => document.querySelectorAll('#allList .al-row').length);
  check('清空筛选后恢复全部自选', restored === geom.chipCount, `${restored} vs ${geom.chipCount}`);

  // 从清单里选股 → 面板收起 + 详情跟随
  if (geom.chipCount >= 2) {
    const target = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('#allList .al-main[data-code]')];
      const cur = document.querySelector('.watchlist .wl-item.active').dataset.code;
      const t = rows.find((r) => r.dataset.code !== cur) || rows[0];
      return { code: t.dataset.code, name: t.querySelector('.al-nm').textContent };
    });
    await page.locator(`#allList .al-main[data-code="${target.code}"]`).click();
    await sleep(1500);
    const picked = await page.evaluate(() => ({
      open: document.querySelector('#allSheet').classList.contains('open'),
      active: document.querySelector('.watchlist .wl-item.active').dataset.code,
      name: document.querySelector('#sName').textContent,
      bodyOverflow: getComputedStyle(document.body).overflow
    }));
    check('从清单选股后清单自动收起', !picked.open);
    check('选中的标的在胶囊条上高亮', picked.active === target.code, `${picked.active} vs ${target.code}`);
    check('详情区切换到该标的', picked.name === target.name, `${picked.name} vs ${target.name}`);
    check('关闭清单后恢复页面滚动', picked.bodyOverflow !== 'hidden', picked.bodyOverflow);
  }

  // 从清单里删除
  const beforeDel = await page.evaluate(() => document.querySelectorAll('.watchlist .wl-item').length);
  await page.locator('#chipAll').click();
  await sleep(400);
  const delCode = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#allList .al-row')];
    const t = rows[rows.length - 1];
    return t.querySelector('.al-main').dataset.code;
  });
  await page.locator(`#allList .al-del[data-del="${delCode}"]`).click();
  await page.waitForFunction((n) => document.querySelectorAll('.watchlist .wl-item').length < n,
    beforeDel, { timeout: 30000 }).catch(() => {});

  const delState = await page.evaluate((code) => ({
    chips: document.querySelectorAll('.watchlist .wl-item').length,
    stillListed: [...document.querySelectorAll('#allList .al-main[data-code]')].some((e) => e.dataset.code === code)
  }), delCode);
  check('清单里删除后胶囊条少一只', delState.chips === beforeDel - 1, `${beforeDel} → ${delState.chips}`);
  check('被删标的从清单中消失', delState.stillListed === false, String(delState.stillListed));
  check('删除后没有弹诊断面板', await page.evaluate(() => document.querySelector('#emptyDiag').hidden));

  // Esc 关闭
  await page.keyboard.press('Escape');
  await sleep(300);
  check('Esc 可关闭清单', await page.evaluate(() => !document.querySelector('#allSheet').classList.contains('open')));

  /* ==================== 4. 图表折叠 ==================== */
  console.log('\n【4】图表折叠');
  await page.locator('.chart-minute .chart-toggle').click();
  await sleep(500);
  const expanded = await page.evaluate(() => {
    const card = document.querySelector('.chart-minute');
    return {
      open: card.classList.contains('open'),
      maxH: getComputedStyle(card.querySelector('.chart-body')).maxHeight,
      h: Math.round(card.querySelector('.chart-body').getBoundingClientRect().height),
      label: card.querySelector('.chart-toggle').textContent.trim(),
      aria: card.querySelector('.chart-toggle').getAttribute('aria-expanded'),
      canvasW: Math.round(card.querySelector('canvas').getBoundingClientRect().width)
    };
  });
  check('点「展开」后图表打开', expanded.open && parseFloat(expanded.maxH) > 100, expanded.maxH);
  check('展开后画布真有宽度（不是 0，否则会画出一张错位图）', expanded.canvasW > 100, `${expanded.canvasW}px`);
  check('按钮文案变为「收起」', /收起/.test(expanded.label), JSON.stringify(expanded.label));
  check('aria-expanded 同步为 true', expanded.aria === 'true', String(expanded.aria));
  await page.screenshot({ path: path.join(SHOTS, SHOT + '3-chart-open.png'), fullPage: false });

  await page.locator('.chart-minute .chart-toggle').click();
  await sleep(400);
  check('再点一次收起', await page.evaluate(() =>
    getComputedStyle(document.querySelector('.chart-minute .chart-body')).maxHeight === '0px'));

  /* ==================== 5. 桌面断点 ==================== */
  console.log('\n【5】切到桌面宽度（>=861px）');
  await page.setViewportSize({ width: 1280, height: 900 });
  await sleep(800);
  const desk = await page.evaluate(() => {
    const cs = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const s = getComputedStyle(el);
      return { display: s.display, position: s.position, flexDirection: s.flexDirection,
        flexBasis: s.flexBasis, maxHeight: s.maxHeight };
    };
    return {
      innerWidth: window.innerWidth,
      panel: cs('#allSheet'),
      mask: cs('#sheetMask'),
      chipAll: cs('#chipAll'),
      sidebar: cs('.sidebar'),
      layout: cs('.layout'),
      watchlist: cs('.watchlist'),
      chip: cs('.watchlist .wl-item'),
      chipDel: cs('.watchlist .wl-item .wl-del'),
      klineBody: cs('.chart-kline .chart-body'),
      chipScore: cs('.watchlist .wl-item .wl-score'),
      chipPrice: cs('.watchlist .wl-item .wl-price'),
      panelOpen: document.querySelector('#allSheet').classList.contains('open')
    };
  });
  check('桌面宽度生效', desk.innerWidth >= 861, `innerWidth=${desk.innerWidth}`);
  check('清单层在桌面彻底隐藏', desk.panel.display === 'none', desk.panel.display);
  check('遮罩层在桌面彻底隐藏', desk.mask.display === 'none', desk.mask.display);
  check('「清单」入口在桌面隐藏（改由侧栏承担）', desk.chipAll.display === 'none', desk.chipAll.display);
  check('侧栏恢复左右分栏（非 sticky）', desk.sidebar.position !== 'sticky', desk.sidebar.position);
  check('主布局恢复 flex 分栏', desk.layout.display === 'flex', desk.layout.display);
  check('胶囊条恢复纵向列表', desk.watchlist.flexDirection === 'column', desk.watchlist.flexDirection);
  check('胶囊恢复 132px 基准宽度', desk.chip.flexBasis !== '136px', desk.chip.flexBasis);
  check('桌面恢复 hover 删除按钮', desk.chipDel.display !== 'none', desk.chipDel.display);
  check('桌面胶囊隐藏「评分」胶囊（保留价格）', desk.chipScore.display === 'none', desk.chipScore.display);
  check('桌面胶囊显示价格', desk.chipPrice.display !== 'none', desk.chipPrice.display);
  check('K线图在桌面默认展开（max-height 已解除折叠）', parseFloat(desk.klineBody.maxHeight) > 300,
    desk.klineBody.maxHeight);
  check('跨断点时清单层自动收起', desk.panelOpen === false);
  await page.screenshot({ path: path.join(SHOTS, SHOT + '4-desktop.png'), fullPage: false });

  /* ==================== 6. 运行期无异常 ==================== */
  console.log('\n【6】运行期异常');
  const realErrors = pageErrors.filter((e) => !/Failed to fetch|Load failed|Network/i.test(e));
  check('无脚本级异常（网络类错误已排除）', realErrors.length === 0, realErrors.join(' | ').slice(0, 300));
  check('传输层没有整体失效（诊断面板未接管）',
    await page.evaluate(() => document.querySelector('#emptyDiag').hidden),
    '若此处失败，通常是本机到 qt.gtimg.cn 的网络不可达，而非改动引起');

  console.log(`\n截图：_shots/planE-*.png`);
  console.log(`\n通过 ${pass} 项，失败 ${fail} 项`);
  if (failures.length) { console.log('失败明细：'); failures.forEach((f) => console.log('  - ' + f)); }
  await browser.close();
  if (srv) srv.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('测试异常：', e); process.exit(1); });
