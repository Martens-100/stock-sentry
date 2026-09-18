'use strict';
/* StockSentry 前端 */

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const fmt = (x, d = 2) => (x == null || Number.isNaN(x) ? '—' : Number(x).toFixed(d));
const fmtMoney = (x) => {
  if (x == null) return '—';
  if (Math.abs(x) >= 1e8) return (x / 1e8).toFixed(2) + '亿';
  if (Math.abs(x) >= 1e4) return (x / 1e4).toFixed(0) + '万';
  return x.toFixed(0);
};
const cls = (x) => (x > 0 ? 'up' : x < 0 ? 'down' : 'flat');
const sign = (x, d = 2) => (x == null ? '—' : `${x > 0 ? '+' : ''}${Number(x).toFixed(d)}`);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- 图标：胶囊与全屏清单里的矢量图标 ----------
   不用 emoji/字体符号：各家系统的字形差异很大，而这里每个图标都要承担「按钮」职责，
   形状不一致会直接造成误点。 */
const ICON = {
  plus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  chev: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  trash: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9.5 7V4.8h5V7M6.6 7l.9 12.2h9l.9-12.2M10.2 11v5M13.8 11v5"/></svg>'
};

/* 操作结论 → 方向。全屏清单里每行要有一个方向徽标，
   实时数据没有原型里那句静态信号名（"均线多头"），用系统自己的 action.key 派生最诚实：
   它本来就是这一个标的的结论，比编一个标签可信。 */
const SIDE_BY_ACTION = {
  BUY: 'bull', ADD: 'bull', HOLD: 'neutral', WATCH: 'neutral',
  REDUCE: 'bear', EXIT: 'bear', AVOID: 'bear', TAKE_PROFIT: 'neutral', NOCHASE: 'neutral'
};

const state = {
  /* ---- 原有 ---- */
  codes: [], current: null, data: null, timer: null, tab: 'bull', refreshSec: 8, report: null,
  /* ---- 方案 E：自选清单（胶囊条的「切换」+ 全屏清单的「管理」） ---- */
  list: [],          // [{ code, name, hasProfile, price, changePct, score, label, side }]
  listError: null,   // 加载失败时的原因，交由 renderChips 呈现（不要在数据层直接写 DOM）
  meta: {},          // code → { score, label, side }：跨 loadWatchlist 保留，否则每 8s 刷新会把评分清空
  sort: 'none',      // none | score | chg | code（只影响全屏清单，胶囊条永远按添加顺序）
  q: '',             // 全屏清单内的本地筛选词
  sheetOpen: false,
  searchRows: null,  // 手机端「按名称/拼音添加」的搜索结果
  searchQ: '',
  warming: false,
  /* 注意：这里没有 "ticking" 了。定时刷新已改为「跑完一轮再排下一轮」的自调度
     （见 startStream），不再需要这个"上一轮没跑完就跳过"的开关 ——
     那个开关的副作用是弱网下连续跳轮，布林与导轨会长时间停在旧值上。 */
  narrow: null       // 上一次的断点归属，用于跨越 860px 时重置图表折叠态
};

/* ============================ API ============================ */
/** 静态部署（GitHub Pages）时由 static-api.js 提供本地实现，其余场景走 HTTP 后端 */
const STATIC_MODE = typeof window !== 'undefined' && window.__SENTRY_STATIC__ === true;

async function api(path, opts) {
  if (STATIC_MODE && window.SentryStatic) return window.SentryStatic.handle(path, opts);
  const r = await fetch(path, opts);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ============================ 自选股 ============================ */
/**
 * 数据层：只把「远端自选 + 行情」整理成 state.list，然后交给 refreshAll 统一渲染。
 *
 * 为什么不再在这里逐元素绑事件（方案 E 的关键结构改动）：
 * 这个列表每 8 秒被重建一次，逐元素 addEventListener 意味着监听器跟着一起重建 ——
 * 「刷新之后点不动」「点了没反应」这类 bug 的老家就在这里。交互全部改为
 * document 级事件委托（见文件末尾 boot()），渲染层因此变成纯粹的叶子函数。
 */
async function loadWatchlist() {
  let r;
  try {
    r = await api('/api/watchlist');
  } catch (e) {
    state.listError = e.message;
    state.list = [];
    refreshAll();
    return;
  }
  state.listError = null;
  state.codes = r.codes;
  state.refreshSec = r.refreshSec || 8;
  const rs = $('#refreshSec'); if (rs) rs.textContent = state.refreshSec;
  const wc = $('#wlCount'); if (wc) wc.textContent = r.list.length;

  state.list = r.list.map((it) => {
    const q = it.quote || {};
    const m = state.meta[it.code] || {};
    return {
      code: it.code,
      name: it.name || m.name || it.code,
      hasProfile: !!it.hasProfile,
      price: q.price == null ? null : q.price,
      changePct: q.changePct == null ? null : q.changePct,
      score: m.score == null ? null : m.score,
      label: m.label || null,
      side: m.side || null
    };
  });
  refreshAll();
  warmScores();            // 补齐还没评分的标的；顺序执行、失败静默（见该函数注释）
}

/**
 * 把一份分析结果里「清单要用的那三样」记进 state.meta。
 * 只留结论级信息，不缓存整个 d.data —— 那是当前标的的详情，缓存 N 份会白占内存，
 * 而且 refreshAll 之后容易拿旧数据渲染新标的。
 */
function applyMeta(code, d) {
  if (!d || !d.scores || !d.action) return;
  state.meta[code] = {
    name: d.name,
    score: d.scores.composite,
    label: d.action.label,
    side: SIDE_BY_ACTION[d.action.key] || 'neutral'
  };
}

/**
 * 评分预热：清单里每只都先算一次，好让胶囊上的「评分」和清单里的方向徽标有真数。
 *
 * 三条硬约束（都是踩过的坑）：
 *   1. 顺序执行 —— 并发 N 个请求在弱网/代理下更容易整体超时，而这只是"锦上添花"的功能；
 *   2. 失败静默 —— app.js 把 unhandledrejection 接到诊断面板上，预热失败若冒泡，
 *      用户会看到一个和自己操作无关的「分析失败」面板；
 *   3. 不覆盖当前标的 —— 当前标的的详情由 selectStock / 定时刷新负责，这里不插手。
 */
async function warmScores() {
  if (state.warming) return;
  state.warming = true;
  try {
    const todo = state.list.filter((it) => it.score == null).map((it) => it.code);
    for (const code of todo) {
      try {
        const r = await api('/api/analyze?code=' + encodeURIComponent(code));
        if (r && r.ok && r.data) {
          applyMeta(code, r.data);
          const it = state.list.find((x) => x.code === code);
          if (it) Object.assign(it, state.meta[code]);
          if (code !== state.current) { renderChips(); renderAll(); }
        }
      } catch (_) { /* 静默：预热失败不影响主流程 */ }
    }
  } finally {
    state.warming = false;
  }
}

/* ============================ 搜索（桌面侧栏） ============================ */
/* 手机端这块被方案 E 的移动布局隐藏（`.add-block{display:none}`），
   添加统一走底部全屏清单的输入框；那里的 `addStock()` 会把非 6 位代码的输入
   转成同一套搜索接口，所以按名称/拼音添加的能力在手机端并没有丢。 */
let searchTimer = null;
async function doSearch() {
  const q = $('#searchInput').value.trim();
  const box = $('#searchResults');
  if (!q) { box.innerHTML = ''; return; }
  try {
    const r = await api('/api/search?q=' + encodeURIComponent(q));
    /* 与 selectStock / startStream 同一防护模式：响应回来后先确认"输入仍是发请求时的那个"。
       搜索框会被连续输入触发（每次输入都发请求），先发的慢响应若直接渲染，
       就会把后发的搜索结果覆盖成旧关键词的结果 —— 用户看到的是"打了新字，列表还是旧的"。 */
    if ($('#searchInput').value.trim() !== q) return;
    box.innerHTML = (r.rows || []).map((x) =>
      `<div class="sr-item" data-add="${esc(x.code)}">
         <span class="sr-name">${esc(x.name)}</span>
         <span class="sr-meta">${esc(x.code)} · ${esc(x.type || '')} <b style="color:var(--accent)">+ 添加</b></span>
       </div>`).join('') || '<div class="empty-hint">未找到匹配标的</div>';
  } catch (e) { box.innerHTML = `<div class="empty-hint">搜索失败：${esc(e.message)}</div>`; }
}
function clearSearchUi() {
  const box = $('#searchResults'); if (box) box.innerHTML = '';
  const inp = $('#searchInput'); if (inp) inp.value = '';
}

/* ============================ 失败诊断 ============================ */
/**
 * 分析失败时给出「可复制」的诊断面板。
 *
 * 为什么需要：静态版没有后端，失败只可能发生在浏览器这一侧
 * （脚本没加载 / 网络被拦 / 浏览器能力缺失 / 接口异常）。
 * 而原来的 toast 三秒即散，远程协助的人拿不到任何有效信息，只能反复猜。
 * 所以这里的首要目标不是「修」，而是「让失败自己说话」：
 * 失败瞬间就把环境事实、错误原文、传输层自检结果一次性摊开并可一键复制。
 */
const BUILD_TAG = 'v1.4';

/**
 * 图表自检：把「布林上下轨 / 导轨通道 / 分时」这条链路的每一环摊开。
 *
 * 为什么值得单独做一份：用户报「图像为空」时，能产生空白的通路至少有五条
 * （数据源没给、样本不足、序列没对齐、画布宽度为 0、值域里混进 NaN），
 * 而这五条**全都不抛错、不留日志**，外观一模一样。没有这份自检，
 * 只能靠反复猜与截图对照；有了它，一次复制就能把范围缩到一层。
 * 控制台里也可以直接跑 window.__chartDiag() 取同样的内容。
 */
function chartDiagRows() {
  const rows = [];
  const ch = state.data && state.data.chart;
  const info = state.data && state.data.chartInfo;
  const cvOf = (sel) => {
    const cv = document.querySelector(sel);
    if (!cv) return null;
    const r = cv.getBoundingClientRect();
    return { cssW: cv.clientWidth, cssH: cv.clientHeight, backingW: cv.width, backingH: cv.height, rectW: Math.round(r.width), rectH: Math.round(r.height) };
  };
  const n = (x) => (Array.isArray(x) ? x.length : x === null || x === undefined ? '—' : typeof x);

  rows.push(['图表载荷', ch
    ? `K线 ${n(ch.kline)} 根 · 布林上/中/下 ${n(ch.boll && ch.boll.up)}/${n(ch.boll && ch.boll.mid)}/${n(ch.boll && ch.boll.dn)} · 导轨 ${ch.rails ? `${n(ch.rails.up)} 点 (bars=${ch.rails.bars}, offset=${ch.rails.offset})` : '未返回'} · 分时 ${n(ch.minutes)} 点`
    : '尚未取得（未选中标的或加载失败）']);
  if (info) rows.push(['数据层自检', `原始K线 ${info.barCount} 根 · 当日bar ${info.todayBar ? (info.todayBar.mode + (info.todayBar.day ? '@' + info.todayBar.day : '') + (info.todayBar.why ? '(' + info.todayBar.why + ')' : '')) : '—'} · 布林 ${info.bollPoints} 点 · 导轨 ${info.railBars} 点${info.railReliable ? '' : '（参考性弱）'}`]);
  if (ch && ch.degraded) rows.push(['降级原因', `<b>${esc(ch.degraded.reason)}</b> — ${esc(ch.degraded.text)}（bars=${ch.degraded.bars}）`]);

  const k = cvOf('#klineChart');
  const m = cvOf('#minuteChart');
  rows.push(['K线画布', k ? `可见宽 ${k.cssW}×${k.cssH}（rect ${k.rectW}×${k.rectH}）· 位图 ${k.backingW}×${k.backingH}` : '❌ 未找到 #klineChart']);
  rows.push(['分时画布', m ? `可见宽 ${m.cssW}×${m.cssH}（rect ${m.rectW}×${m.rectH}）· 位图 ${m.backingW}×${m.backingH}` : '❌ 未找到 #minuteChart']);
  rows.push(['画布尺寸异常', pendingChartRepaint
    ? `<b>是</b> — 上次绘制时尺寸不可用（w=${pendingChartRepaint.w}），已登记待补画；展开图表或旋转屏幕会自动重画`
    : '否（绘制时尺寸正常）']);
  rows.push(['叠加层开关', `布林 ${chartOpts.boll ? '开' : '关'} · 导轨 ${chartOpts.rail ? '开' : '关'} · 均线 ${chartOpts.ma ? '开' : '关'}`]);
  const viz = document.querySelector('#railViz');
  rows.push(['轨道可视化', viz
    ? `${viz.children.length} 行${viz.querySelectorAll('.rv-row-empty').length ? `（其中 ${viz.querySelectorAll('.rv-row-empty').length} 行为「不可用」占位）` : ''}`
    : '❌ 未找到 #railViz']);
  return rows;
}
window.__chartDiag = () => chartDiagRows().map(([k, v]) => k + '：' + String(v).replace(/<[^>]+>/g, '')).join('\n');

/** 同步即可取到的环境事实 —— 不需要用户点任何按钮 */
function envFacts() {
  const scripts = Array.from(document.querySelectorAll('script[src]'))
    .map((s) => s.getAttribute('src')).join(' · ') || '（无）';
  return [
    ['页面版本', esc(BUILD_TAG)],
    ['运行模式', STATIC_MODE ? '静态版 · 浏览器直连行情（<b>不需要后端，也不需要任何配置</b>）' : '服务端版'],
    ['bundle.js 运行时', window.SentryLib ? '✅ 已加载' : '❌ <b>未加载</b>（这是关键线索）'],
    ['static-api.js 接口替身', window.SentryStatic ? '✅ 已注册' : '❌ <b>未注册</b>（这是关键线索）'],
    ['已加载脚本', esc(scripts)],
    ['传输层', esc(transportText())],
    ['页面地址', esc(location.href)],
    ['UA', esc(navigator.userAgent)]
  ];
}

/** 传输层自述：fetch 直连是否可用、有没有已经切到 JSONP 兜底 */
function transportText() {
  try {
    const t = window.SentryLib && window.SentryLib.source && window.SentryLib.source.transportInfo
      ? window.SentryLib.source.transportInfo() : null;
    if (!t) return '未知（运行时未加载）';
    return `${t.mode} · fetch 成功 ${t.fetchOk} 次 / 失败 ${t.fetchFail} 次`
      + ` · JSONP 成功 ${t.jsonpOk} 次 / 失败 ${t.jsonpFail} 次`
      + (t.lastError ? ` · 最近错误：${t.lastError}` : '');
  } catch (_) { return '读取失败'; }
}

/** 按错误特征给出最可能的原因 —— 写给非技术用户看，直接给结论和下一步 */
function guessCause(err) {
  const msg = String((err && err.message) || err || '');
  if (!window.SentryLib) {
    return '页面脚本 <code>bundle.js</code> 没有加载成功，浏览器里就没有任何分析能力。常见原因：网络只放行了部分文件、广告拦截/隐私保护类插件拦截、或页面没加载完就被点开。请先按 <b>Ctrl/Cmd + Shift + R</b> 强制刷新整页再试。';
  }
  if (STATIC_MODE && !window.SentryStatic) {
    return '<code>static-api.js</code> 没有注册成功，静态版的接口替身没起来。请强制刷新页面重试。';
  }
  if (/Unexpected token|not valid JSON|JSON/i.test(msg)) {
    return '接口返回的不是 JSON。静态版下这几乎总是意味着请求被静态站点「回退」成了 HTML 页面（bundle.js 未加载或路径被中间层改写），请强制刷新后再试。';
  }
  if (/Failed to fetch|NetworkError|Load failed|Network request failed|jsonp|timeout|超时/i.test(msg)) {
    return '浏览器既连不上行情接口（fetch 直连失败），JSONP 兜底也没成功。这属于<b>网络层问题</b>，不是网站本身的问题：常见于公司代理/防火墙、广告拦截插件、微信等 App 的内置浏览器、或境外网络。建议换 <b>手机流量热点</b>、或换系统自带浏览器（Safari / Chrome）再试一次。';
  }
  if (/TextDecoder|gbk|decode|编码/i.test(msg)) {
    return '当前浏览器不支持 GBK 解码。请改用较新的 Chrome / Edge / Safari，或升级系统后重试。';
  }
  if (/HTTP 4\d\d|HTTP 5\d\d/.test(msg)) {
    return '请求落到了一个并不存在的 HTTP 路径（静态版本来就不需要后端）。通常是 bundle.js 未加载导致请求没被本地接管，请强制刷新后再试。';
  }
  return '暂未匹配到已知特征，请把下方「环境事实 + 网络自检」整段复制发给开发者，即可定位。';
}

function clearDiag() {
  const box = $('#emptyDiag');
  if (box) { box.hidden = true; box.innerHTML = ''; }
}

/** @returns {boolean} 是否成功显示了面板（调用方据此决定要不要隐藏占位区） */
function showDiag(err, code) {
  const box = $('#emptyDiag');
  if (!box) return false;
  box.hidden = false;
  // 失败接管：隐藏正常占位与详情，只留诊断面板，避免两块同时可见
  $('#empty').hidden = true;
  $('#detail').hidden = true;
  box.innerHTML = `<div class="diag">
    <h3>⚠️ 分析失败 · 诊断面板</h3>
    <p class="diag-cause">${guessCause(err)}</p>
    <table class="diag-tb">
      <tr><td>标的</td><td><code>${esc(code || '—')}</code></td></tr>
      <tr><td>错误类型</td><td><code>${esc((err && err.name) || 'Error')}</code></td></tr>
      <tr><td>错误信息</td><td><code>${esc((err && err.message) || String(err))}</code></td></tr>
      ${envFacts().map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`).join('')}
    </table>
    <h4 class="diag-sub">图表自检（K线 / 布林上下轨 / 导轨通道 / 分时）</h4>
    <table class="diag-tb">
      ${chartDiagRows().map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`).join('')}
    </table>
    <div class="diag-actions">
      <button class="btn primary" id="diagCopy">复制诊断信息</button>
      <button class="btn ghost" id="diagRun">重新运行网络自检</button>
      <button class="btn ghost" id="diagReload">强制刷新页面</button>
    </div>
    <div id="diagOut" class="diag-out"></div>
    <p class="diag-note">把上面这段（含自检结果）整段复制发给开发者即可。</p>
  </div>`;

  $('#diagCopy').addEventListener('click', copyDiag);
  $('#diagRun').addEventListener('click', runNetCheck);
  // 不能用 location.reload()：它可能仍从浏览器缓存里拿同一份旧脚本，刷新等于没刷。
  // 带上一次性查询参数，URL 变了就一定重新取，才能真正绕过缓存。
  $('#diagReload').addEventListener('click', () => {
    const u = new URL(location.href);
    u.searchParams.set('r', String(Date.now()));
    location.href = u.toString();
  });
  if (box.scrollIntoView) box.scrollIntoView({ block: 'nearest' });   // 旧引擎可能没实现
  runNetCheck();   // 失败即自动自检，省掉「请你去点一下」的来回
  return true;
}

/** 浏览器兼容的兜底复制（navigator.clipboard 不可用时走 execCommand） */
function copyTextFallback(txt) {
  const ta = document.createElement('textarea');
  ta.value = txt;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); toast('诊断信息已复制'); } catch (_) { toast('请手动选中文本'); }
  document.body.removeChild(ta);
}

function copyDiag() {
  const box = $('#emptyDiag');
  const txt = [
    `【StockSentry 诊断】${BUILD_TAG} ${new Date().toLocaleString()}`,
    (box ? box.innerText : ''),
    (($('#diagOut') && $('#diagOut').innerText) || '')
  ].join('\n').trim();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt)
      .then(() => toast('诊断信息已复制，发给开发者即可'))
      .catch(() => copyTextFallback(txt));
  } else {
    copyTextFallback(txt);
  }
}

/** 逐项探测失败出在哪一层：浏览器能力 → 外网连通 → 接口返回 */
async function runNetCheck() {
  const out = $('#diagOut');
  if (!out) return;
  out.innerHTML = '<div class="diag-row">检测中…</div>';
  const lines = [];

  lines.push(['fetch 可用', typeof fetch === 'function' ? '✅ 是' : '❌ 否（浏览器过旧或被禁用）']);
  let dec = '✅ 支持';
  try { new TextDecoder('gbk'); } catch (_) { dec = '❌ 不支持（腾讯快照返回 GBK，解码会失败）'; }
  lines.push(['TextDecoder("gbk")', dec]);
  lines.push(['localStorage 可用', (() => { try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return '✅ 是'; } catch (_) { return '⚠️ 否（无痕模式？自选股无法保存）'; } })()]);
  lines.push(['页面协议', location.protocol + (location.protocol === 'file:' ? ' ⚠️ 本地文件打开，fetch 会被浏览器禁止（将依赖 JSONP 兜底）' : '')]);

  const probes = [
    ['实时快照 qt.gtimg.cn', 'https://qt.gtimg.cn/q=sz000063'],
    ['日K线 web.ifzq.gtimg.cn', 'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=sz000063,day,,,5,qfq'],
    ['分时 web.ifzq.gtimg.cn', 'https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=sz000063']
  ];
  for (const [label, url] of probes) {
    const t0 = Date.now();
    try {
      const res = await fetch(url, { mode: 'cors', referrerPolicy: 'no-referrer', cache: 'no-store' });
      const buf = await res.arrayBuffer();
      const warn = (res.status === 200 && buf.byteLength > 0) ? '' : ' ⚠️ 返回为空';
      lines.push(['fetch · ' + label, `✅ HTTP ${res.status} · ${buf.byteLength} 字节 · ${Date.now() - t0}ms${warn}`]);
    } catch (e) {
      lines.push(['fetch · ' + label, `❌ ${e.name}: ${e.message}`]);
    }
  }

  // JSONP 兜底通道是否可用（fetch 被拦时这是最后的生命线）
  for (const [label, url, varName] of [
    ['JSONP · 快照', 'https://qt.gtimg.cn/q=sz000063', 'v_sz000063'],
    ['JSONP · 日K', 'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=sz000063,day,,,5,qfq&_var=diag_k', 'diag_k']
  ]) {
    try {
      const v = await window.SentryLib.source.jsonp(url, varName, 6000);
      lines.push([label, v == null ? '❌ 未返回数据' : `✅ 可用（${String(typeof v === 'string' ? v : JSON.stringify(v)).length} 字符）`]);
    } catch (e) {
      lines.push([label, `❌ ${e.name}: ${e.message}`]);
    }
  }

  out.innerHTML = lines.map(([k, v]) =>
    `<div class="diag-row"><span>${esc(k)}</span><b class="${/^❌/.test(v) ? 'bad' : ''}">${esc(v)}</b></div>`
  ).join('');
}

/* 让任何未捕获的脚本错误也浮出水面（否则在别人的手机上，报错只会消失在控制台里） */
window.addEventListener('error', (e) => {
  if (e && e.target && e.target.tagName === 'SCRIPT') {
    showDiag(new Error('脚本加载失败：' + (e.target.getAttribute('src') || '')), state.current);
    return;
  }
  if (e && (e.error || e.message)) showDiag(e.error || new Error(e.message), state.current);
}, true);
window.addEventListener('unhandledrejection', (e) => {
  const r = e && e.reason;
  if (r) showDiag(r instanceof Error ? r : new Error(String(r)), state.current);
});

/* ============================ 详情渲染 ============================ */
/**
 * 选中标的。
 *
 * 顺序有讲究：先给「即时反馈」（高亮胶囊 / 收起清单 / 回到顶部），再等网络出详情。
 * 反过来的话，弱网下用户点完胶囊要愣一两秒才看到任何变化，会以为没点上，
 * 然后反复点 —— 而每一次点击都会再发一个请求。
 */
async function selectStock(code) {
  const changed = state.current !== code;
  state.current = code;
  state.sheetOpen = false;          // 从清单里选完就收起来，别挡着刚选中的详情
  state.searchRows = null;
  resetSheetQuery();
  $('#empty').hidden = true;
  $('#detail').hidden = false;
  clearDiag();
  if (changed) resetReport();       // 换了标的，上一只的报告必须清掉，不能挂在新标的名下
  refreshAll();
  centerChip();
  scrollTop();
  const reqCode = code;
  try {
    const r = await api('/api/analyze?code=' + encodeURIComponent(code));
    if (state.current !== reqCode) return;            // 已切到其它标的，丢弃过期响应，避免「点了A却显示B」
    if (!r.ok) throw new Error(r.error);
    state.data = r.data;
    applyMeta(code, r.data);                          // 让胶囊与清单立刻拿到这一只的评分/结论
    refreshAll();
  } catch (e) {
    if (state.current !== reqCode) return;            // 已切换，不再弹诊断覆盖新标的
    // 把版本号一起写进提示：远程看一张截图就能判断对方跑的是不是最新代码
    toast(`分析失败：${e.message} —— 详情见下方诊断面板（${BUILD_TAG}）`);
    showDiag(e, code);                                 // showDiag 负责隐藏 empty/detail，由诊断面板接管
    console.error(e);
  }
}

function renderDetail(d) {
  /* 没有数据就什么都不做：首屏、切换瞬间、以及刷新失败时都会走到这里。
     保留上一屏/占位内容，比先清成空白再填要好 —— 不会闪，也不会把已经画好的
     K 线在每次轻量刷新（如开合清单）时抹掉。显隐由 selectStock / showDiag 控制。 */
  if (!d) return;
  const q = d.quote;
  const c = q.changePct;

  /* 头部 */
  $('#sName').textContent = d.name;
  $('#sCode').textContent = d.code + (d.market === 'sh' ? '.SH' : d.market === 'sz' ? '.SZ' : '.BJ')
    + (d.profile ? ` · 画像来源：${d.profile.sourceDoc}` : '');
  $('#sTags').innerHTML = (d.profile?.tags || []).map((t) => `<span class="tag">${t}</span>`).join('');
  $('#sPrice').textContent = fmt(q.price);
  $('#sPrice').className = 'price ' + cls(c);
  $('#sChange').textContent = `${sign(q.change)}  ${sign(c)}%`;
  $('#sChange').className = 'change ' + cls(c);
  $('#sTime').textContent = `行情时间 ${q.time || '—'}｜数据源 ${q.source === 'tencent' ? '腾讯财经' : q.source === 'sina' ? '新浪财经' : q.source}`;

  const stats = [
    ['今开', fmt(q.open)], ['昨收', fmt(q.preClose)],
    ['最高', fmt(q.high)], ['最低', fmt(q.low)],
    ['成交额', fmtMoney(q.amount) + '元'], ['换手率', q.turnover != null ? fmt(q.turnover) + '%' : '—'],
    ['量比', q.volumeRatio != null ? fmt(q.volumeRatio) : '—'], ['振幅', q.amplitude != null ? fmt(q.amplitude) + '%' : '—'],
    ['PE(TTM)', q.peTtm != null ? fmt(q.peTtm) : '—'], ['PE(动/静)', `${q.peDynamic != null ? fmt(q.peDynamic) : '—'} / ${q.peStatic != null ? fmt(q.peStatic) : '—'}`],
    ['PB', q.pb != null ? fmt(q.pb) : '—'], ['总市值', q.totalCap ? fmt(q.totalCap, 0) + '亿' : '—'],
    ['52周位置', d.ind.position52 + '%'], ['ATR波动率', d.ind.atrPct + '%'],
    ['MA5 / MA20', `${d.ind.ma.ma5} / ${d.ind.ma.ma20}`], ['MA60', `${d.ind.ma.ma60}`],
    ['RSI(14)', d.ind.rsi], ['MACD柱', d.ind.macd.hist]
  ];
  $('#sStats').innerHTML = stats.map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('');

  /* 结论 */
  const a = d.action, sc = d.scores;
  const color = a.color;
  $('#actionLabel').textContent = a.label;
  $('#actionLabel').style.color = color;
  $('#actionDesc').textContent = a.desc;
  $('#scoreNum').textContent = sc.composite;
  const C = 2 * Math.PI * 52;
  const g = $('#gaugeFg');
  g.style.strokeDasharray = C;
  g.style.strokeDashoffset = C - (C * sc.composite) / 100;
  g.style.stroke = color;
  $('#barTech').style.width = sc.technical + '%';
  $('#valTech').textContent = sc.technical;
  $('#barProfile').style.width = (sc.profile ?? 0) + '%';
  $('#valProfile').textContent = sc.profile ?? '—';
  $('#barConf').style.width = a.confidence + '%';
  $('#valConf').textContent = a.confidence;

  $('#actionReasons').innerHTML = a.reasons.map((r) => {
    const k = r.startsWith('【支撑】') ? 'bull' : r.startsWith('【压制】') ? 'bear' : '';
    return `<li class="${k}">${r}</li>`;
  }).join('');

  /* 交易计划 */
  const p = d.plan;
  /* P3 价位口径披露：逐档来源徽标（研报 / ATR反推 / 引擎推导） */
  const lv = p.levelLabels || {};
  const lvBadge = (label) => {
    if (!label) return '';
    const cls = label === '研报' ? 'lv-report' : label === 'ATR反推' ? 'lv-auto' : 'lv-engine';
    return `<i class="lv-badge ${cls}">${label}</i>`;
  };
  const rows = [
    { k: '建仓区间', v: p.entry?.[0] ? `${p.entry[0]} ~ ${p.entry[1]}` : '—', o: lv.entry },
    { k: '第一目标位', v: p.target1 ?? '—', o: lv.target1 },
    { k: '第二目标位', v: p.target2 ?? '—', o: lv.target2 },
    { k: '止损位', v: p.stopLoss ?? '—', o: lv.stopLoss },
    { k: '硬止损位', v: p.hardStop ?? '—', o: lv.hardStop },
    { k: '盈亏比', v: p.riskReward ? p.riskReward + ' : 1' : '—' },
    { k: '建议仓位上限', v: p.positionLimitPct + '%' },
    { k: 'ATR(14)', `${p.atr}（${p.atrPct}%）` },
    { k: '距止损空间', v: p.stopLoss ? fmt(((q.price - p.stopLoss) / q.price) * 100) + '%' : '—' },
    { k: '距目标空间', v: p.target1 ? fmt(((p.target1 - q.price) / q.price) * 100) + '%' : '—' }
  ];
  $('#planGrid').innerHTML = rows.map((r) => `<div class="pg-item"><span>${r.k}${r.o ? lvBadge(r.o) : ''}</span><b>${r.v}</b></div>`).join('')
    + (p.rrNote ? `<div class="pg-item" style="grid-column:1/-1;background:var(--warn-bg);border-color:#f0e0bd"><span>盈亏比提示</span><b style="font-size:12.5px;font-weight:400;color:var(--ink-2)">${p.rrNote}</b></div>` : '');

  const bk = p.batchKind;
  $('#batchTitle').textContent = bk === 'exit' ? '仓位处置节奏（当前不宜建仓）'
    : bk === 'conditional' ? '条件性建仓节奏（需信号确认后执行）' : '分批建仓节奏';
  $('#batchTable').innerHTML = '<thead><tr><th>步骤</th><th>触发条件</th><th>处置比例</th><th>说明</th></tr></thead><tbody>'
    + p.batches.map((b, i) => `<tr><td>${bk === 'exit' ? '第 ' + (i + 1) + ' 步' : '第 ' + (i + 1) + ' 批'}</td><td>${b.at}</td><td>${b.ratio}</td><td>${b.note}</td></tr>`).join('')
    + '</tbody>';

  const lv = [
    ...p.resistances.slice(0, 4).map((x) => ({ ...x, k: 'res' })),
    ...p.supports.slice(0, 4).map((x) => ({ ...x, k: 'sup' }))
  ];
  $('#levelList').innerHTML = lv.map((x) =>
    `<div class="level-row ${x.k}">
       <span>${x.k === 'res' ? '阻力' : '支撑'}${x.label ? ` · ${x.label}` : ''}</span>
       <span><b>${x.price}</b> <span class="${x.dist >= 0 ? 'up' : 'down'}">${sign(x.dist)}%</span></span>
     </div>`).join('') || '<div class="hint">暂无显著关键位</div>';

  /* 信号 */
  $('#cntBull').textContent = d.signals.bull.length;
  $('#cntBear').textContent = d.signals.bear.length;
  $('#cntNeutral').textContent = d.signals.neutral.length;
  $('#cntAll').textContent = d.signals.all.length;
  renderSignals();

  /* 监控清单：专项清单（来自投研文档）或自动清单（由实时行情派生），两种都必须显示。
     每一项都已由 lib/monitors.js 的脚手架求值 —— 状态为看多/看空的会真正参与综合评分，
     不再只是"展示一行说明"。 */
  const mons = d.monitors || d.profile?.monitors || [];
  const src = d.monitorsSource || 'auto';
  const sum = d.monitorSummary || null;
  const SRC_META = {
    profile: { cls: 'profile', text: '专项清单 · 来自投研文档' },
    auto: { cls: 'generic', text: '自动清单 · 由实时行情派生（非投研结论）' }
  };
  const meta = SRC_META[src] || SRC_META.auto;

  $('#monitorCard').hidden = false;
  $('#monitorTitle').textContent = '核心监控清单（利好 / 利空双向 · 自动判定）';
  const badge = $('#monitorBadge');
  badge.hidden = false;
  badge.className = 'src-badge ' + meta.cls;
  badge.textContent = meta.text;

  const STATE_BADGE = {
    bull: ['看多', 'bull'], bear: ['看空', 'bear'], neutral: ['中性', 'neutral'],
    pending: ['待复核', 'muted'], manual: ['人工跟踪', 'muted'],
    inapplicable: ['不适用', 'muted'], na: ['数据不足', 'muted']
  };
  const stateBadge = (s) => {
    const [label, cls] = STATE_BADGE[s] || STATE_BADGE.na;
    return `<span class="st-badge ${cls}">${label}</span>`;
  };

  const summaryLine = sum ? `<div class="mon-sum">
      <b>清单结论：</b>${sum.verdict}
      <span class="mon-sub">可判定 ${sum.judgeable} / 列出 ${sum.listed} 项</span>
      ${sum.gapNote ? `<div class="mon-gap">${sum.gapNote}</div>` : ''}
    </div>` : '';

  if (mons.length) {
    $('#monitorTableWrap').innerHTML = summaryLine + `<table class="data">
      <thead><tr><th>跟踪维度</th><th>关键指标</th><th>观察窗口</th><th>🔴 利好信号</th><th>🟢 利空信号</th><th>当前状态</th><th>权重</th></tr></thead>
      <tbody>${mons.map((m) => `<tr class="${m.triggered ? 'mon-hit' : ''}">
        <td><b>${m.dim}</b></td><td>${m.metric}</td><td>${m.window}</td>
        <td style="color:var(--up)">${m.bull}</td><td style="color:var(--down)">${m.bear}</td>
        <td class="mon-now">${stateBadge(m.state)}<div class="mon-note">${m.note || '—'}</div></td>
        <td>${'★'.repeat(Math.min(5, Math.round(m.weight / 2)))} ${m.weight}</td>
      </tr>`).join('')}</tbody></table>`;
  } else {
    $('#monitorTableWrap').innerHTML = summaryLine + '<div class="hint">暂无可用监控项（行情数据不足）。</div>';
  }

  /* 画像 */
  const pf = d.profile;
  $('#profileCard').hidden = !pf;
  if (pf) {
    const blocks = [];
    if (pf.auto) {
      blocks.push(`<div class="auto-note">⚠️ <b>自动画像</b>：本卡片由实时行情与 K 线自动生成，<b>不是投研报告</b>，`
        + `不含基本面判断、机构观点与公司调研结论。${pf.disclaimer ? pf.disclaimer + '。' : ''}关键决策请自行核实。</div>`);
    }
    if (pf.thesis) blocks.push(`<div class="thesis"><b>${pf.auto ? '技术面画像：' : '核心逻辑：'}</b>${pf.thesis}</div>`);
    if (pf.moat) blocks.push(`<div class="thesis" style="background:#fafbfc;border-left-color:var(--line)"><b>竞争壁垒：</b>${pf.moat}</div>`);

    const boxes = [];
    if (pf.levels && pf.levels.entry && pf.levels.entry[0] != null) {
      const L = pf.levels;
      boxes.push(`<div class="pf-box"><h4>交易价位${pf.auto ? '（按 ATR 推导）' : ''}</h4><p>`
        + `建仓区间 ${L.entry[0]} ~ ${L.entry[1]} 元<br>`
        + `止损 ${L.stopLoss ?? '—'} / 硬止损 ${L.hardStop ?? '—'}<br>`
        + `目标一 ${L.target1 ?? '—'} / 目标二 ${L.target2 ?? '—'}</p></div>`);
    }
    if (pf.valuation && pf.valuation.fairPe) {
      boxes.push(`<div class="pf-box"><h4>估值框架</h4><p>PE(TTM) 参照 ${pf.valuation.fairPe.join('-')} 倍<br>${pf.valuation.note || ''}</p></div>`);
    } else if (pf.valuation && pf.valuation.note) {
      boxes.push(`<div class="pf-box"><h4>估值说明</h4><p>${pf.valuation.note}</p></div>`);
    }
    if (pf.businessMix?.length) boxes.push(`<div class="pf-box"><h4>业务结构</h4><p>${pf.businessMix.map((b) => `${b.name} ${b.share}%（${b.trend}）`).join('<br>')}</p></div>`);
    if (pf.chips) boxes.push(`<div class="pf-box"><h4>筹码结构</h4><p>${pf.chips}</p></div>`);
    if (pf.fundamentals && Object.keys(pf.fundamentals).length) {
      if (pf.auto) {
        const LABEL = {
          peTtm: 'PE(TTM)', pb: 'PB', totalCap: '总市值', floatCap: '流通市值',
          turnover: '换手率(%)', volumeRatio: '量比', position52: '52周位置(%)',
          drawdownFromHigh: '距52周高点(%)', atrPct: 'ATR波动率(%)', source: '数据源'
        };
        const lines = Object.entries(pf.fundamentals)
          .filter(([, v]) => v != null && v !== '')
          .map(([k, v]) => `${LABEL[k] || k}：${v}`);
        if (lines.length) boxes.push(`<div class="pf-box"><h4>行情快照</h4><p>${lines.join('<br>')}</p></div>`);
      } else {
        boxes.push(`<div class="pf-box"><h4>关键财务</h4><p>${Object.values(pf.fundamentals).slice(0, 6).join('<br>')}</p></div>`);
      }
    }
    if (pf.catalysts?.length) boxes.push(`<div class="pf-box"><h4>业绩兑现节奏</h4><p>${pf.catalysts.map((x) => `${x.time}：${x.event}`).join('<br>')}</p></div>`);
    if (pf.risks?.length) boxes.push(`<div class="pf-box"><h4>风险提示</h4><p>${pf.risks.map((x) => '· ' + x).join('<br>')}</p></div>`);
    if (pf.sourceDoc) boxes.push(`<div class="pf-box"><h4>信息来源</h4><p>${pf.sourceDoc}${pf.reportDate ? `<br>报告日期：${pf.reportDate}` : ''}</p></div>`);

    $('#profileBody').innerHTML = blocks.join('') + `<div class="profile-grid">${boxes.join('')}</div>`;
  }

  /* 报告区不在这里重置。
     原因：renderDetail 现在由 refreshAll 统一调度，一次开合清单、一次切页都会走到它；
     把「清空报告」放进来，就会变成「刚生成完报告，随手点开清单就把下载按钮锁了」。
     报告只在真正换标的时清（selectStock → resetReport）。 */

  renderChannel(d.ind);
  drawMinute(d.chart);
  drawKline(d.chart, d.ind);
}

/** 换标的时清报告：body 要回到提示语，否则会出现「B 的标题下挂着 A 的报告」 */
function resetReport() {
  state.report = null;
  const h = $('#downloadHtml'); if (h) h.disabled = true;
  const m = $('#downloadMd'); if (m) m.disabled = true;
  const b = $('#reportBody'); if (b) b.innerHTML = REPORT_HINT;
}

function redrawCharts() {
  if (!state.data) return;
  drawMinute(state.data.chart);
  drawKline(state.data.chart, state.data.ind);
}

function renderSignals() {
  const d = state.data;
  const list = state.tab === 'all' ? d.signals.all : d.signals[state.tab];
  $('#signalList').innerHTML = list.map((s) => `
    <div class="sig ${s.side}">
      <div class="sig-head">
        <span class="sig-side ${s.side}">${s.side === 'bull' ? '利好' : s.side === 'bear' ? '利空' : '中性'}</span>
        <span class="sig-name">${esc(s.name)}</span>
        <span class="sig-dim">${esc(s.dim)}</span>
        <span class="sig-stars">${'★'.repeat(Math.max(1, Math.min(5, Math.round(s.strength))))}</span>
        <span class="sig-dim">权重 ${s.weight}</span>
        ${s.origin === 'profile' ? '<span class="tag" style="font-size:10px">画像规则</span>' : ''}
      </div>
      <div class="sig-text">${esc(s.text)}</div>
      <div class="sig-evi">📊 ${esc(s.evidence)}</div>
    </div>`).join('') || '<div class="hint">暂无该类信号</div>';
}

/* ============================ 轨道研判 ============================ */
const hexA = (hex, a) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
const clampN = (x, a, b) => Math.min(b, Math.max(a, x));

/** 把建议文案按句读点拆开，用于「窄屏逐句成行 / 宽屏横向铺满」的排布。
    **绝不能用 lookbehind**（`(?<=…)`）：目标用户里有 iOS 14 的 Safari，
    遇到 lookbehind 会在解析阶段直接抛 SyntaxError，整个 bundle 起不来。
    本项目所有正则都要守这条 —— 所以这里用 match 捕获式切分。
    拆句不是为了改文案，只是为了拿到可独立换行的片段：
    此前整段是一个文本节点，393px 竖屏下被压成 87px 宽的竖缝（每行 3 个字）。 */
const splitAdvice = (t) => (String(t == null ? '' : t).match(/[^，。；]+[，。；]?/g) || [])
  .map((s) => s.trim()).filter(Boolean);

function railRow(label, lo, hi, mid, pct, color, markVal, tickLabel) {
  if (!(hi > lo)) return '';
  const P = (v) => clampN(((v - lo) / (hi - lo)) * 100, 0, 100);
  const pos = clampN(pct, 0, 1) * 100;
  return `<div class="rv-row">
    <div class="rv-label">${label}</div>
    <div>
      <div class="rv-track">
        <div class="rv-zone" style="left:0;right:0;background:${hexA(color, .07)}"></div>
        <div class="rv-zone" style="left:${P(mid)}%;right:0;background:${hexA(color, .10)}"></div>
        <div class="rv-mark" style="left:calc(${pos}% - 1.5px)"></div>
      </div>
      <div class="rv-ticks">
        <span class="rv-tick" style="left:0">${lo}</span>
        <span class="rv-tick" style="left:${P(mid)}%">${mid}</span>
        <span class="rv-tick" style="left:100%">${hi}</span>
      </div>
    </div>
    <div class="rv-val" style="color:${color}">${markVal}<br><em style="font-weight:400;color:var(--muted)">${tickLabel}</em></div>
  </div>`;
}

/** 数据不可用时的占位行 —— **绝不让整行凭空消失**。
    「这条线数据异常」和「这张图什么都没有」是两件事，用户必须能分清；
    原来 `railRow` 用 `if (!(hi > lo)) return ''` 静默丢行，
    三条轨道全丢时 railViz 直接变成一片空白，看上去就是「图像为空」。 */
function railRowEmpty(label, reason) {
  return `<div class="rv-row rv-row-empty">
    <div class="rv-label">${label}</div>
    <div><div class="rv-track rv-track-empty"></div></div>
    <div class="rv-val">不可用<br><em>${esc(reason)}</em></div>
  </div>`;
}

function renderChannel(ind) {
  const box = $('#chGrid');
  const viz = $('#railViz');
  const v = ind && ind.channelVerdict;
  /* 拿不到研判结论时，必须**同时**把可视化区清成明确说明。
     原来这里只 `return`，railViz 会留着上一只标的的图 ——
     用户看到的是 A 的轨道套在 B 的标题下，比空白更危险。 */
  if (!v) {
    const why = ind ? '本标的未返回轨道指标（通常是日K数据不足）' : '尚未取得行情数据';
    if (box) box.innerHTML = `<div class="hint">轨道数据不可用：${why}</div>`;
    if (viz) viz.innerHTML = `<div class="rv-empty-hint">轨道可视化不可用 —— ${why}</div>`;
    const z0 = $('#chZone'); if (z0) z0.textContent = '—';
    const a0 = $('#chAdvice'); if (a0) a0.textContent = '—';
    return;
  }

  const z = $('#chZone');
  z.textContent = v.zone;
  z.style.background = hexA(v.color, .10);
  z.style.color = v.color;
  const ad = $('#chAdvice');
  /* 建议按句拆开渲染：窄屏每句独占一行 —— 「方向未选择；」这类关键句因此自然凸显；
     宽屏则横向流式铺满整行，不留大片空白。
     不拆时整段是一个文本节点，393px 竖屏会把它压成 87px 宽的竖缝（每行 3 个字）。 */
  const adSegs = splitAdvice(v.advice);
  ad.innerHTML = adSegs.length
    ? adSegs.map((s) => `<span class="ad-seg">${esc(s)}</span>`).join('')
    : esc(v.advice || '—');
  ad.style.borderLeftColor = v.color;

  const bi = ind.bollInfo, ra = ind.rails, dc = ind.donchian;
  box.innerHTML = [
    `<div class="ch-item"><h4>布林轨道（20, 2）</h4><div class="ch-vals">
       上轨 <b>${v.boll.up}</b>　中轨 <b>${v.boll.mid}</b>　下轨 <b>${v.boll.dn}</b><br>
       <em>%B ${bi ? (bi.pctB * 100).toFixed(0) : '—'}%　带宽 ${bi ? bi.bandwidthPct : '—'}%（近120日 ${bi ? bi.bandwidthPctile : '—'}% 分位）</em><br>
       <b>${bi ? bi.stateLabel : '—'}</b>
     </div></div>`,
    ra ? `<div class="ch-item"><h4>回归导轨通道（自适应窗口）</h4><div class="ch-vals">
       上轨 <b>${ra.up}</b>　中轨 <b>${ra.mid}</b>　下轨 <b>${ra.dn}</b><br>
       <em>窗口 ${ra.bars} 根 · k=${ra.k}　斜率 ${ra.slope20Pct}%/20日　宽度 ${ra.widthPct}%</em><br>
       <b>${v.railDirLabel}</b>　通道位置 ${(ra.pctChan * 100).toFixed(0)}%${ra.reliable ? '' : '　⚠参考性弱'}
     </div></div>` : '',
    dc ? `<div class="ch-item"><h4>唐奇安区间导轨（20日）</h4><div class="ch-vals">
       上沿 <b>${dc.upper}</b>　下沿 <b>${dc.lower}</b>　中值 <b>${dc.mid}</b><br>
       <em>区间宽度 ${(dc.upper - dc.lower).toFixed(2)} 元</em><br>
       当前位置 <b>${dc.pct}%</b>
     </div></div>` : ''
  ].join('');

  /* 三行轨道：每一行要么给出真实的区间与当前位置，要么给出**可见的**不可用原因。
     不允许出现「行消失了，用户以为本来就是两条」这种情况。 */
  const rows = [];
  if (bi && v.boll && v.boll.up > v.boll.dn) {
    rows.push(railRow('布林轨道', v.boll.dn, v.boll.up, v.boll.mid, bi.pctB, '#7e57c2', fmt(ind.price), v.bollLabel));
  } else {
    rows.push(railRowEmpty('布林轨道', bi ? '上下轨重合或缺失' : '未返回布林带'));
  }
  if (ra && ra.up > ra.dn) {
    rows.push(railRow('回归导轨', ra.dn, ra.up, ra.mid, ra.pctChan, '#ff9800', fmt(ind.price), v.railPosLabel));
  } else {
    rows.push(railRowEmpty('回归导轨', ra ? '上下轨重合' : '样本不足（需 ≥12 根日K）'));
  }
  if (dc && dc.upper > dc.lower) {
    rows.push(railRow('唐奇安区间', dc.lower, dc.upper, dc.mid, dc.pct / 100, '#0288d1', fmt(ind.price), `区间 ${dc.pct}%`));
  } else {
    rows.push(railRowEmpty('唐奇安区间', dc ? '上下沿重合' : '未返回区间数据'));
  }
  if (viz) viz.innerHTML = rows.join('');
}

/* ============================ 图表 ============================ */
/* 画布尺寸不可用时的「待补画」登记。
   为什么需要它：卡片折叠（max-height:0）、容器 display:none、后台标签页、首帧未布局时，
   clientWidth 会是 0。此时 cv.width = 0，之后所有绘制都静默落到画布之外 ——
   不抛错、不留痕迹，只是一块白。用户报的「图像为空」有一半来自这一幕。
   正确做法不是"照样画"，而是登记下来，等尺寸真的可用时补画一次。 */
let pendingChartRepaint = null;

function setupCanvas(cv, h) {
  if (!cv) return { ok: false, reason: 'missing-canvas' };
  const dpr = window.devicePixelRatio || 1;
  const w = Math.round(cv.clientWidth || (cv.parentElement && cv.parentElement.clientWidth) || 0);
  const hh = Math.round(h);
  if (w < 40 || hh < 40) {
    pendingChartRepaint = { reason: 'canvas-zero-size', w, h: hh, at: Date.now() };
    return { ok: false, reason: 'canvas-zero-size', w, h: hh };
  }
  cv.width = w * dpr;
  cv.height = hh * dpr;
  cv.style.height = hh + 'px';
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, hh);
  return { ok: true, ctx, w, h: hh, dpr };
}

/**
 * 图表降级说明。**用 DOM 而不是画在 canvas 上** —— 画布宽度为 0 时根本画不出字，
 * 而「为什么这里是空的」恰恰要在那一刻告诉用户。空图不给理由，
 * 用户只能猜到「坏了」；给了理由，他能分清是数据源的问题还是自己的网络。
 */
function setChartNote(which, text) {
  const el = document.getElementById(which + 'Note');
  if (!el) return;
  const card = el.closest && el.closest('.chart-card');
  if (text) { el.textContent = text; el.hidden = false; if (card) card.classList.add('has-note'); }
  else { el.textContent = ''; el.hidden = true; if (card) card.classList.remove('has-note'); }
}

/** 图表区说明的叶子渲染器：只读 state，不碰别的渲染函数 */
function renderChartNotes() {
  const d = state.data;
  const ch = d && d.chart;
  if (!ch) { setChartNote('minute', ''); setChartNote('kline', ''); return; }
  const deg = ch.degraded;
  if (deg) {
    const why = deg.reason === 'no-kline'
      ? '数据源（腾讯财经）本次未返回日K数据'
      : `日K仅 ${deg.bars} 根，不足指标计算窗口`;
    setChartNote('kline', `K线、布林上下轨与导轨通道暂不可用 —— ${why}。行情与指标已自动降级为可用部分，可稍后重试。`);
    /* 空图的原因除了「数据源没给」，还有「序列没对齐 / 画布 0 宽 / 值域混进 NaN」等
       几条同样静默的通路，外观完全一样。顺手把自检打进控制台，远程排查时省一轮来回。 */
    try { console.info('[StockSentry] 图表自检\n' + window.__chartDiag()); } catch (_) {}
    setChartNote('minute', '');
    return;
  }
  setChartNote('kline', '');
  setChartNote('minute', ch.minutes && ch.minutes.length ? '' : '暂无分时数据（非交易时段或数据源限制）');
}

const COL = {
  up: '#d0342c', down: '#12855a', grid: '#eef0f3', ink: '#7a828f', line: '#2450a4', avg: '#e6a23c',
  ma5: '#e6a23c', ma10: '#2450a4', ma20: '#8e44ad', ma60: '#12855a',
  bollUp: '#e91e63', bollMid: '#b39ddb', bollDn: '#00acc1', rail: '#ff9800'
};
const chartOpts = { boll: true, rail: true, ma: true, cross: null };

function drawMinute(chart) {
  const cv = $('#minuteChart');
  const c = setupCanvas(cv, 220);
  if (!c.ok) return;   // 尺寸不可用：已登记待补画，这里不画废图
  const { ctx, w, h } = c;
  const padL = 52, padR = 56, padT = 12, padB = 34;
  const cw = w - padL - padR, chh = h - padT - padB;
  const ticks = (chart && chart.minutes) || [];
  const preClose = chart && chart.preClose;

  ctx.font = '11px -apple-system,sans-serif';
  if (!ticks.length) {
    ctx.fillStyle = COL.ink; ctx.textAlign = 'center';
    ctx.fillText('暂无分时数据（非交易时段或数据源限制）', w / 2, h / 2);
    return;
  }

  // 计算均价
  let prevVol = 0, cumAmt = 0;
  const rows = ticks.map((t) => {
    const dv = Math.max(0, t.volume - prevVol); prevVol = t.volume;
    cumAmt = t.amount;
    const avg = t.volume > 0 ? t.amount / (t.volume * 100) : t.price;
    return { ...t, avg: Number.isFinite(avg) ? avg : t.price };
  });

  const prices = rows.map((r) => r.price);
  const maxDev = Math.max(
    Math.max(...prices.map((p) => Math.abs(p - preClose))),
    Math.max(...rows.map((r) => Math.abs(r.avg - preClose))),
    preClose * 0.002
  );
  const hi = preClose + maxDev * 1.08, lo = preClose - maxDev * 1.08;
  const X = (i) => padL + (cw * i) / Math.max(1, rows.length - 1);
  const Y = (p) => padT + chh * (1 - (p - lo) / (hi - lo));

  // 网格
  ctx.strokeStyle = COL.grid; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padT + (chh * i) / 4;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + cw, y); ctx.stroke();
    const v = hi - ((hi - lo) * i) / 4;
    ctx.fillStyle = v > preClose ? COL.up : COL.down;
    ctx.textAlign = 'right'; ctx.fillText(v.toFixed(2), padL - 6, y + 4);
    ctx.textAlign = 'left';
    const pctv = ((v - preClose) / preClose) * 100;
    ctx.fillStyle = pctv > 0 ? COL.up : COL.down;
    ctx.fillText(`${pctv > 0 ? '+' : ''}${pctv.toFixed(2)}%`, padL + cw + 6, y + 4);
  }
  // 时间轴
  const marks = [0, Math.floor(rows.length / 4), Math.floor(rows.length / 2), Math.floor((rows.length * 3) / 4), rows.length - 1];
  ctx.fillStyle = COL.ink; ctx.textAlign = 'center';
  marks.forEach((i) => ctx.fillText(rows[i].time, X(i), h - 12));

  // 昨收线
  ctx.strokeStyle = '#c9cfda'; ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(padL, Y(preClose)); ctx.lineTo(padL + cw, Y(preClose)); ctx.stroke();
  ctx.setLineDash([]);

  // 填充
  const lastP = rows[rows.length - 1].price;
  const mainColor = lastP >= preClose ? COL.up : COL.down;
  const grad = ctx.createLinearGradient(0, padT, 0, padT + chh);
  grad.addColorStop(0, lastP >= preClose ? 'rgba(208,52,44,.20)' : 'rgba(18,133,90,.20)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.beginPath();
  rows.forEach((r, i) => (i ? ctx.lineTo(X(i), Y(r.price)) : ctx.moveTo(X(i), Y(r.price))));
  ctx.lineTo(padL + cw, padT + chh); ctx.lineTo(padL, padT + chh); ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();

  // 价格线
  ctx.strokeStyle = mainColor; ctx.lineWidth = 1.6; ctx.beginPath();
  rows.forEach((r, i) => (i ? ctx.lineTo(X(i), Y(r.price)) : ctx.moveTo(X(i), Y(r.price))));
  ctx.stroke();

  // 均价线
  ctx.strokeStyle = COL.avg; ctx.lineWidth = 1.1; ctx.beginPath();
  rows.forEach((r, i) => (i ? ctx.lineTo(X(i), Y(r.avg)) : ctx.moveTo(X(i), Y(r.avg))));
  ctx.stroke();

  // 末端标记
  const ex = X(rows.length - 1), ey = Y(lastP);
  ctx.fillStyle = mainColor;
  ctx.beginPath(); ctx.arc(ex, ey, 3.2, 0, Math.PI * 2); ctx.fill();
  ctx.textAlign = 'left'; ctx.font = 'bold 11px -apple-system,sans-serif';
  ctx.fillText(lastP.toFixed(2), padL + cw + 6, ey + 4 > padT + chh ? ey : ey + 4);

  // 成交量柱（底部）
  const vh = 26, vy0 = padT + chh + 6;
  const maxV = Math.max(...rows.map((r) => r.volume), 1);
  rows.forEach((r, i) => {
    const hgt = (r.volume / maxV) * vh;
    ctx.fillStyle = r.price >= (rows[i - 1]?.price ?? preClose) ? 'rgba(208,52,44,.55)' : 'rgba(18,133,90,.55)';
    ctx.fillRect(X(i), vy0 + vh - hgt, Math.max(1, cw / rows.length - 0.6), hgt);
  });
}

function drawKline(chart, ind) {
  const cv = $('#klineChart');
  const c = setupCanvas(cv, 380);
  if (!c.ok) return;   // 尺寸不可用：已登记待补画，不画废图
  const { ctx, w, h } = c;
  const padL = 52, padR = 16, padT = 10, padB = 22;
  const cw = w - padL - padR;
  const k = (chart && chart.kline) || [];
  /* 绘图区宽度必须为正：极窄视口下 cw ≤ 0 会让 step ≤ 0，
     所有点被算到画布左侧之外 —— 又是"一片空白但不报错"。 */
  if (cw < 40) {
    ctx.font = '12px -apple-system,sans-serif';
    ctx.fillStyle = COL.ink; ctx.textAlign = 'center';
    ctx.fillText('可用宽度不足，无法绘制图表', w / 2, h / 2);
    return;
  }
  /* 没有 K 线就画一句人话再收工。
     原来是直接 `return` —— 留下整块白，连「是数据源没给、还是对齐炸了、还是代码坏了」
     都无从判断；这正是被报成「图像为空」的那种形态。空要有空的理由。 */
  if (!k.length) {
    ctx.font = '12px -apple-system,sans-serif';
    ctx.fillStyle = COL.ink; ctx.textAlign = 'center';
    ctx.fillText('暂无K线数据（数据源未返回日K）', w / 2, h / 2);
    return;
  }

  const h1 = Math.round((h - padT - padB) * 0.58);          // K线区
  const h2 = Math.round((h - padT - padB) * 0.16);          // 量区
  const h3 = h - padT - padB - h1 - h2;                     // MACD 区
  const y1 = padT, y2 = padT + h1 + 8, y3 = y2 + h2 + 8;
  const step = cw / k.length;
  const bw = Math.max(1.5, step * 0.68);

  // ---- 计算 MA ----
  const closes = k.map((x) => x.close);
  const ma = (n) => closes.map((_, i) => (i < n - 1 ? null : closes.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0) / n));
  const ma5 = ma(5), ma10 = ma(10), ma20 = ma(20), ma60 = ma(60);

  /* ---- 轨道序列对齐 ----
     导轨只覆盖最近 bars 根，必须落回 K 线的正确下标上。
     对齐方式有优先级，因为「靠长度相减」是一个**隐式契约**：
     它只在「kline 截断长度」与「导轨窗口来源」恰好一致时成立，
     任何一侧改了口径，导轨就会被整体画到画布之外 —— 整条导轨消失，
     而且不抛错、不告警。所以：
       ① 优先按 dates 锚点（导轨自带首点日期）在 K 线日期里定位；
       ② 退化用载荷显式给出的 offset；
       ③ 最后才用长度相减（历史兼容）。
     并把结果裁剪到画布内，宁可少画一点也不画到外面去。 */
  const railRaw = chartOpts.rail && chart && chart.rails ? chart.rails : null;
  const railLenRaw = railRaw ? Math.min(
    Array.isArray(railRaw.up) ? railRaw.up.length : 0,
    Array.isArray(railRaw.dn) ? railRaw.dn.length : 0
  ) : 0;
  let rail = null;
  let railOffset = 0;
  let railLen = 0;
  if (railRaw && railLenRaw > 2) {
    const kd = k.map((x) => x.date);
    const anchor = Array.isArray(railRaw.dates) && railRaw.dates.length ? railRaw.dates[0] : null;
    const byDate = anchor ? kd.indexOf(anchor) : -1;
    railOffset = byDate >= 0 ? byDate
      : Number.isFinite(railRaw.offset) ? railRaw.offset
        : Math.max(0, k.length - railLenRaw);
    railOffset = Math.max(0, Math.min(k.length - 3, railOffset));
    railLen = Math.min(railLenRaw, k.length - railOffset);
    if (railLen > 2) {
      rail = {
        up: railRaw.up.slice(0, railLen),
        mid: Array.isArray(railRaw.mid) ? railRaw.mid.slice(0, railLen) : [],
        dn: railRaw.dn.slice(0, railLen)
      };
      /* railOffset 此刻已经是「首点对应的 K 线下标」，下面统一按它绘制，无需再换算 */
    }
  }
  /* ---- 布林序列对齐 ----
     载荷已保证等长，这里仍做一次防御：长度不符时按末尾对齐，
     多出来的部分锯掉。宁可少画一段，也不要把曲线画到别的交易日上去。 */
  const alignSeries = (arr) => {
    if (!Array.isArray(arr) || !arr.length) return null;
    if (arr.length === k.length) return arr;
    if (arr.length > k.length) return arr.slice(-k.length);
    return new Array(k.length - arr.length).fill(null).concat(arr);
  };
  const boll = chartOpts.boll && chart ? chart.boll : null;

  /* ---- 值域 ----
     只能由**有限数**决定。这里必须过滤：只要混进一个 undefined / NaN，
     Math.max 就返回 NaN，Y() 全线变 NaN，整张图一笔都画不出来 ——
     不抛错、不告警，就是一块白。这又是一条「图像为空」的静默通路，堵掉。 */
  const rangeVals = [];
  k.forEach((x) => {
    if (Number.isFinite(x.high)) rangeVals.push(x.high);
    if (Number.isFinite(x.low)) rangeVals.push(x.low);
  });
  const bollUp = boll ? alignSeries(boll.up) : null;
  const bollMid = boll ? alignSeries(boll.mid) : null;
  const bollDn = boll ? alignSeries(boll.dn) : null;
  [bollUp, bollDn, rail && rail.up, rail && rail.dn].forEach((arr) => {
    if (Array.isArray(arr)) arr.forEach((v) => { if (Number.isFinite(v)) rangeVals.push(v); });
  });
  if (rangeVals.length < 2) {
    ctx.font = '12px -apple-system,sans-serif';
    ctx.fillStyle = COL.ink; ctx.textAlign = 'center';
    ctx.fillText('K线数值异常，无法绘制（数据源返回了非数值行情）', w / 2, h / 2);
    return;
  }
  const hi = Math.max(...rangeVals);
  const lo = Math.min(...rangeVals);
  /* hi === lo 时 (hi+pad)-(lo-pad) 会退化成 0 → 除零 → NaN → 同样整图空白 */
  const pad = hi > lo ? (hi - lo) * 0.05 : Math.max(Math.abs(hi) * 0.005, 0.01);
  const Y1 = (p) => y1 + h1 * (1 - (p - (lo - pad)) / ((hi + pad) - (lo - pad)));
  const X = (i) => padL + step * i + step / 2;

  ctx.font = '10.5px -apple-system,sans-serif';
  // 网格
  ctx.strokeStyle = COL.grid; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const yy = y1 + (h1 * i) / 4;
    ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(padL + cw, yy); ctx.stroke();
    ctx.fillStyle = COL.ink; ctx.textAlign = 'right';
    ctx.fillText((hi + pad - ((hi + pad) - (lo - pad)) * (i / 4)).toFixed(2), padL - 6, yy + 4);
  }
  // 日期
  ctx.fillStyle = COL.ink; ctx.textAlign = 'center';
  [0, Math.floor(k.length / 3), Math.floor((k.length * 2) / 3), k.length - 1].forEach((i) =>
    ctx.fillText(String((k[i] && k[i].date) || '').slice(5), X(i), y3 + h3 + 16));

  // ---- K线 ----
  k.forEach((bar, i) => {
    const up = bar.close >= bar.open;
    ctx.strokeStyle = up ? COL.up : COL.down;
    ctx.fillStyle = up ? '#fff' : COL.down;
    const x = X(i);
    ctx.beginPath(); ctx.moveTo(x, Y1(bar.high)); ctx.lineTo(x, Y1(bar.low)); ctx.stroke();
    const yo = Y1(bar.open), yc = Y1(bar.close);
    const top = Math.min(yo, yc), bh = Math.max(1, Math.abs(yc - yo));
    if (up) { ctx.fillStyle = '#fff'; ctx.fillRect(x - bw / 2, top, bw, bh); ctx.strokeRect(x - bw / 2, top, bw, bh); }
    else { ctx.fillRect(x - bw / 2, top, bw, bh); }
  });

  /* ---- 通用折线 / 填充绘制器 ---- */
  const pathLine = (arr, color, lw, dash, offset = 0) => {
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.setLineDash(dash || []);
    ctx.beginPath();
    let started = false;
    arr.forEach((v, i) => {
      if (v == null) { started = false; return; }
      const x = X(offset + i), y = Y1(v);
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    });
    ctx.stroke(); ctx.restore();
  };
  const pathFill = (a1, a2, color, offset = 0) => {
    ctx.save();
    ctx.beginPath();
    let started = false;
    a1.forEach((v, i) => { if (v == null) return; const x = X(offset + i), y = Y1(v); if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y); });
    for (let i = a2.length - 1; i >= 0; i--) { const v = a2[i]; if (v == null) continue; ctx.lineTo(X(offset + i), Y1(v)); }
    ctx.closePath(); ctx.fillStyle = color; ctx.fill(); ctx.restore();
  };

  /* ---- 布林上下轨 ----
     用对齐后的序列绘制；只要有一条不可用就不画（而不是画半条让人误读） */
  if (bollUp && bollDn) {
    pathFill(bollUp, bollDn, 'rgba(126,87,194,.07)');
    pathLine(bollUp, COL.bollUp, 1.1);
    pathLine(bollDn, COL.bollDn, 1.1);
    if (bollMid) pathLine(bollMid, COL.bollMid, 1, [4, 3]);
  }

  /* ---- 回归导轨通道（按 railOffset 落回 K 线下标，已裁剪在画布内） ---- */
  if (rail) {
    pathFill(rail.up, rail.dn, 'rgba(255,152,0,.09)', railOffset);
    pathLine(rail.up, COL.rail, 1.3, [6, 3], railOffset);
    pathLine(rail.dn, COL.rail, 1.3, [6, 3], railOffset);
    if (rail.mid.length) pathLine(rail.mid, 'rgba(255,152,0,.75)', 1, [2, 3], railOffset);
  }

  // ---- 均线 ----
  if (chartOpts.ma) {
    pathLine(ma5, COL.ma5, 1); pathLine(ma10, COL.ma10, 1);
    pathLine(ma20, COL.ma20, 1.2); pathLine(ma60, COL.ma60, 1.2);
  }

  // ---- 成交量 ----
  const volVals = k.map((x) => (Number.isFinite(x.volume) ? x.volume : 0));
  const maxV = Math.max(...volVals, 1);
  k.forEach((bar, i) => {
    const bh = (volVals[i] / maxV) * h2;
    ctx.fillStyle = bar.close >= bar.open ? 'rgba(208,52,44,.60)' : 'rgba(18,133,90,.60)';
    ctx.fillRect(X(i) - bw / 2, y2 + h2 - bh, bw, bh);
  });
  ctx.strokeStyle = COL.grid; ctx.beginPath(); ctx.moveTo(padL, y2 + h2); ctx.lineTo(padL + cw, y2 + h2); ctx.stroke();

  // ---- MACD ----
  const dif = alignSeries(chart.macd && chart.macd.dif) || [];
  const dea = alignSeries(chart.macd && chart.macd.dea) || [];
  const hist = alignSeries(chart.macd && chart.macd.hist) || [];
  const mMax = Math.max(...hist.map(Math.abs), ...dif.map(Math.abs), ...dea.map(Math.abs), 0.01);
  const Y3 = (v) => y3 + h3 / 2 - (v / mMax) * (h3 / 2) * 0.9;
  ctx.strokeStyle = '#e6e8eb'; ctx.beginPath(); ctx.moveTo(padL, y3 + h3 / 2); ctx.lineTo(padL + cw, y3 + h3 / 2); ctx.stroke();
  hist.forEach((v, i) => {
    if (v == null) return;
    ctx.fillStyle = v >= 0 ? 'rgba(208,52,44,.65)' : 'rgba(18,133,90,.65)';
    const y0 = Y3(0), yv = Y3(v);
    ctx.fillRect(X(i) - bw / 2, Math.min(y0, yv), bw, Math.max(1, Math.abs(yv - y0)));
  });
  const mline = (arr, color) => {
    ctx.strokeStyle = color; ctx.lineWidth = 1.1; ctx.beginPath();
    let st = false;
    arr.forEach((v, i) => { if (v == null) return; if (!st) { ctx.moveTo(X(i), Y3(v)); st = true; } else ctx.lineTo(X(i), Y3(v)); });
    ctx.stroke();
  };
  mline(dif, '#e6a23c'); mline(dea, '#2450a4');
  ctx.fillStyle = COL.ink; ctx.textAlign = 'left';
  ctx.fillText('MACD(12,26,9)', padL + 2, y3 + 10);
}

/* ============================ 报告 ============================ */
async function genReport() {
  if (!state.current) return;
  const btn = $('#genReport');
  btn.disabled = true; btn.textContent = '生成中…';
  try {
    const r = await api('/api/report?code=' + encodeURIComponent(state.current));
    if (!r.ok) throw new Error(r.error);
    state.report = r;
    $('#reportBody').innerHTML = r.bodyHtml || '<p>生成失败</p>';
    $('#downloadHtml').disabled = false;
    $('#downloadMd').disabled = false;
    toast(r.files && r.files.length ? '报告已生成：' + r.files.join(' / ') : '报告已生成，可下载 HTML / Markdown');
  } catch (e) {
    toast('报告生成失败：' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = '生成报告';
  }
}

function download(name, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}

/* ==========================================================================
   方案 E · 顶部胶囊（切换）+ 内容横滑换股 + 底部全屏清单（管理）
   --------------------------------------------------------------------------
   层级：数据层 → 计算层(纯函数) → 渲染层(叶子) → refreshAll() 统一调度。

   铁律：refreshAll 是唯一的调度者，也是唯一的联动点；渲染函数之间不互相调用。
   为什么值得这么严：一旦「A 里调 B、B 里又调 A」，就会在 state 只更新了一半的时候
   触发重绘，表现是随机的错位、翻倍渲染、以及"点了没反应但过一会儿又对了"这类
   无法复现的 bug。叶子渲染 + 单点调度，是唯一能长时间稳住的结构。
   交互一律走 document 级委托（列表每 8s 重建一次，逐元素绑定必然踩坑）。
   ========================================================================== */

/* 报告区的初始提示语：从 index.html 原样抓一次，避免同一段文案在两处维护而漂移 */
const REPORT_HINT = (() => {
  const el = $('#reportBody');
  return (el && el.innerHTML) || '';
})();

/* ------------------------- 计算层（纯函数，不碰 DOM） ------------------------- */

/** 全屏清单要显示的那一份：先按关键词筛，再排序。
    只影响清单 —— 顶部胶囊条永远按「添加顺序」，位置稳定才点得准。 */
function viewList() {
  const q = state.q.trim().toLowerCase();
  const arr = state.list.filter((d) =>
    !q || d.code.indexOf(q) >= 0 || String(d.name).toLowerCase().indexOf(q) >= 0);
  if (state.sort === 'score') arr.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  else if (state.sort === 'chg') arr.sort((a, b) => (b.changePct ?? -999) - (a.changePct ?? -999));
  else if (state.sort === 'code') arr.sort((a, b) => a.code.localeCompare(b.code));
  return arr;
}

/* --------------------- 渲染层（叶子函数，互不调用） --------------------- */

/**
 * 顶部胶囊条（手机上是主切换控件）。
 *
 * 同一份结构供两端用，靠 CSS 切换显隐，不按视口写两套渲染：
 *   桌面 —— 名称 / ✕移除 / 代码 / 价格 / 涨跌幅（沿用原有信息密度）
 *   手机 —— 名称 / 涨跌幅 ｜ 代码 / 评分（方案 E 的几何：一眼判断该不该点进去）
 * 因此同一个数值会出现两次（.m-only / .d-only 各一份），这是刻意的：
 * 用纯 CSS 切显隐，比在 JS 里按 innerWidth 分支渲染要稳 ——
 * 后者在旋转屏幕、拖动窗口时会出现「渲染了但没重渲染」的中间态。
 */
function renderChips() {
  const box = $('#watchlist');
  if (!box) return;
  if (state.listError) {
    box.innerHTML = `<div class="loading">加载失败：${esc(state.listError)}</div>`;
    return;
  }

  const chips = state.list.map((it) => {
    const k = it.changePct == null ? 'flat' : cls(it.changePct);
    const cs = it.changePct == null ? '—' : sign(it.changePct) + '%';
    return `<div class="wl-item ${state.current === it.code ? 'active' : ''}" data-code="${esc(it.code)}" role="button" tabindex="0" title="${esc(it.name)}">
      <div class="wl-row1">
        <span class="wl-name">${esc(it.name)}${it.hasProfile ? '<span class="tag" style="font-size:10px">画像</span>' : ''}</span>
        <span class="wl-chg m-only ${k}">${cs}</span>
        <button class="wl-del" data-del="${esc(it.code)}" title="移除">✕</button>
      </div>
      <div class="wl-row2">
        <span class="wl-code">${esc(it.code)}</span>
        <span class="wl-score m-only">评分 ${it.score == null ? '—' : it.score}</span>
        <span class="wl-q"><span class="wl-price ${k}">${it.price == null ? '—' : fmt(it.price)}</span><span class="wl-chg d-only ${k}"> ${it.changePct == null ? '' : cs}</span></span>
      </div>
    </div>`;
  }).join('');

  /* 空列表的提示按端给不同的话：手机端上方根本没有搜索框，指过去只会让人找不到 */
  const empty = state.list.length ? ''
    : `<div class="empty-hint">
         <span class="d-only">暂无自选股，请在上方搜索添加</span>
         <span class="m-only">暂无自选股，点右侧「清单」添加</span>
       </div>`;

  /* 「清单」入口必须无条件渲染，空列表时也要在。
     手机端添加标的的唯一入口就在清单里（搜索框被移动布局隐藏了）——
     跟着空列表一起藏掉会变成死锁：没标的 → 没入口 → 加不了标的。 */
  box.innerHTML = empty + chips
    + `<button class="chip-all" id="chipAll" type="button" title="打开自选清单">清单 ${state.list.length}${ICON.chev}</button>`;
}

/**
 * 底部全屏清单的行。两种内容共用同一块列表区：
 *   自选态 —— 可点行（换股）+ 删除
 *   搜索态 —— 搜索结果（添加）；手机端没有桌面那块搜索框，按名称/拼音添加由这里接管
 */
function renderAll() {
  const box = $('#allList');
  if (!box) return;
  const cnt = $('#allCnt');

  if (state.searchRows) {
    const rows = state.searchRows;
    if (cnt) cnt.textContent = `搜索「${state.searchQ}」 ${rows.length} 条`;
    const cancel = '<button type="button" data-cancel-search>取消搜索</button>';
    box.innerHTML = rows.length
      ? `<div class="as-note">点右侧「添加」加入自选${cancel}</div>` + rows.map((x) => `<div class="al-row">
          <div class="al-main">
            <div class="al-t1"><span class="al-nm">${esc(x.name)}</span><span class="al-cd">${esc(x.code)}</span></div>
            <div class="al-t2"><span class="al-sc">${esc(x.type || '')}</span></div>
          </div>
          <button class="al-add" type="button" data-add="${esc(x.code)}">添加</button>
        </div>`).join('')
      : `<div class="as-note">没有匹配「${esc(state.searchQ)}」的标的${cancel}</div>`;
    return;
  }

  const arr = viewList();
  if (cnt) cnt.textContent = `${state.list.length} 只 · 显示 ${arr.length}`;
  box.innerHTML = arr.length
    ? arr.map((d) => {
      const k = d.changePct == null ? 'flat' : cls(d.changePct);
      return `<div class="al-row${d.code === state.current ? ' active' : ''}">
        <div class="al-main" data-code="${esc(d.code)}" role="button" tabindex="0">
          <div class="al-t1"><span class="al-nm">${esc(d.name)}</span><span class="al-cd">${esc(d.code)}</span></div>
          <div class="al-t2">
            <span class="al-chg ${k}">${d.changePct == null ? '—' : sign(d.changePct) + '%'}</span>
            <span class="al-cd">${d.price == null ? '—' : '¥' + fmt(d.price)}</span>
            <span class="al-sc">评分 ${d.score == null ? '—' : d.score}</span>
            <span class="al-side ${d.side || ''}">${esc(d.label || '待评估')}</span>
          </div>
        </div>
        <button class="al-del" type="button" data-del="${esc(d.code)}" title="移除">${ICON.trash}</button>
      </div>`;
    }).join('')
    : `<div class="as-empty">${state.list.length ? '没有匹配的标的' : '自选还是空的，在下面添加一只'}</div>`;

  $$('#allSorts button').forEach((b) => b.classList.toggle('active', b.getAttribute('data-sort') === state.sort));
}

/* 图表折叠：默认态由断点决定 —— 桌面展开（顺带避免 JS 未跑完时闪一下空白），
   手机折叠（否则 380px 的 K 线把详情正文顶到很远）。 */
const isNarrow = () => window.innerWidth <= 860;
function chartIsOpen(card) {
  return isNarrow() ? card.classList.contains('open') : !card.classList.contains('collapsed');
}
function setChartOpen(card, open) {
  if (isNarrow()) card.classList.toggle('open', open);
  else card.classList.toggle('collapsed', !open);
}
/** 回到当前端的默认态：两端都只需清掉标记（手机无 .open=折叠，桌面无 .collapsed=展开） */
function resetChartsForViewport() {
  $$('.chart-card').forEach((card) => card.classList.remove('open', 'collapsed'));
}

function renderChartLabel() {
  $$('.chart-card').forEach((card) => {
    const btn = card.querySelector('.chart-toggle');
    if (!btn) return;
    const open = chartIsOpen(card);
    btn.innerHTML = (open ? '收起' : '展开') + ICON.chev;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
}

function renderSheetState() {
  const sh = $('#allSheet'), mk = $('#sheetMask');
  if (sh) sh.classList.toggle('open', state.sheetOpen);
  if (mk) mk.classList.toggle('open', state.sheetOpen);
  /* 锁住页面滚动：否则清单里向下滑动会「穿透」到背后长页面上，手指一松才发现跑偏了 */
  document.body.style.overflow = state.sheetOpen ? 'hidden' : '';
}

/* ------------------ 统一刷新入口（唯一调度者，唯一联动点） ------------------ */
function refreshAll() {
  renderChips();
  renderDetail(state.data);
  renderAll();
  renderChartLabel();
  renderChartNotes();
  renderSheetState();
}

/** 尺寸恢复后补画一次。
    折叠展开、旋转屏幕、从后台标签页切回 —— 这些时刻画布才有真实宽度，
    而数据早就在手上。没有这一步，"待补画"就只是一个记录而已。 */
function repaintChartsIfPending(force) {
  if (!pendingChartRepaint && !force) return;
  pendingChartRepaint = null;
  redrawCharts();
}

/* ------------------- 交互层：改数据 → 调 refreshAll ------------------- */

/** 把当前胶囊滚到可视区中间：横滑之后选中项可能停在屏幕外，用户会找不到自己在哪 */
function centerChip() {
  const a = document.querySelector('.watchlist .wl-item.active');
  if (!a || !a.scrollIntoView) return;
  try { a.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); }
  catch (_) { a.scrollIntoView(); }
}

function scrollTop() {
  const box = document.querySelector('.content');
  if (box) box.scrollTop = 0;
  if (isNarrow()) window.scrollTo(0, 0);
}

function openSheet(flag) {
  state.sheetOpen = !!flag;
  if (!state.sheetOpen) {
    state.searchRows = null;
    resetSheetQuery();
  }
  refreshAll();
}

function resetSheetQuery() {
  state.q = '';
  const el = $('#allSearch'); if (el) el.value = '';
}

/** 选中一只：同一只就只是收起清单，不做无谓的重新分析 */
async function applyPick(code) {
  if (!code) return;
  if (code === state.current) { state.sheetOpen = false; refreshAll(); return; }
  await selectStock(code);
}

/** 横滑换股：按「添加顺序」在 list 里前后挪一位（与胶囊条的排列一致） */
async function step(delta) {
  if (state.list.length < 2) return;
  const i = state.list.findIndex((x) => x.code === state.current);
  const j = (Math.max(0, i) + delta + state.list.length) % state.list.length;
  await selectStock(state.list[j].code);
}

async function removeStock(code) {
  const wasCurrent = state.current === code;
  try {
    await api('/api/watchlist', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remove: code })
    });
  } catch (e) { toast('移除失败：' + e.message); return; }
  delete state.meta[code];
  toast('已移除 ' + code);
  await loadWatchlist();
  if (!wasCurrent) return;
  const next = state.list[0];
  if (next) { await selectStock(next.code); return; }
  state.current = null;
  state.data = null;
  $('#detail').hidden = true;
  $('#empty').hidden = false;
  clearDiag();
  refreshAll();
}

async function addByCode(code) {
  if (state.list.some((x) => x.code === code)) {
    toast('已在自选中');
    state.sheetOpen = false;
    await selectStock(code);
    return;
  }
  try {
    await api('/api/watchlist', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ add: code })
    });
  } catch (e) { toast('添加失败：' + e.message); return; }
  toast('已添加到自选：' + code);
  state.searchRows = null;
  resetSheetQuery();
  const inp = $('#addInput'); if (inp) inp.value = '';
  clearSearchUi();
  await loadWatchlist();
  await selectStock(code);   // selectStock 内部会把清单收起
}

/**
 * 清单里的「添加」。6 位代码直接加；否则当作名称/拼音去搜索。
 * 这一条是为了守住原有能力：桌面侧栏那块搜索框在手机上被方案 E 隐藏了，
 * 如果这里只认 6 位数字，手机用户就再也没法用「茅台」这种输入添加标的。
 */
async function addStock() {
  const inp = $('#addInput');
  if (!inp) return;
  const raw = inp.value.trim();
  if (!raw) return;
  const m = raw.match(/\d{6}/);
  if (m) { await addByCode(m[0]); return; }
  try {
    const r = await api('/api/search?q=' + encodeURIComponent(raw));
    /* 同上：移动端底部清单的输入框同样会被连续输入触发，过期响应不得覆盖新结果。
       注意此处比的是输入框当前值而非 state.searchQ —— searchQ 是"上一次成功搜索的关键词"，
       用它比对会把"连续两次相同输入"误判为过期。 */
    if (inp.value.trim() !== raw) return;
    state.searchRows = r.rows || [];
    state.searchQ = raw;
    refreshAll();
  } catch (e) { toast('搜索失败：' + e.message); }
}

/* ============================ 实时刷新 ============================ */
/**
 * 自调度循环：**跑完一轮，再隔 refreshSec 排下一轮**。
 *
 * 为什么不用 setInterval + 「上一轮没跑完就跳过」：
 * 那种写法在弱网下会连续跳过若干轮 —— 只要单次请求耗时超过一个周期，
 * 就会「跑一轮、跳两轮、再跑一轮」，布林上下轨与导轨于是长时间停在旧值上。
 * 用户报的「图像不随实时状态更新」，本质就是这段调度漂了。
 * 自调度保证的是：每完成一轮，间隔 refreshSec 秒再跑，永不堆积、也永不长时间停滞。
 *
 * 每轮的顺序也有讲究：先拉自选（胶囊与清单的价格），再分析当前标的（图表与轨道），
 * 最后 `refreshAll()` 一次性重画 —— 布林与导轨用的就是这一轮刚到的实时价。
 */
function startStream() {
  if (state.timer) clearTimeout(state.timer);
  state.timer = setTimeout(async function loop() {
    if (!state.timer) return;                        // 已被停止
    try {
      if ($('#autoRefresh').checked && !document.hidden) {
        await loadWatchlist();
        const cur = state.current;
        if (cur) {
          const r = await api('/api/analyze?code=' + encodeURIComponent(cur));
          if (state.current === cur && r.ok) { state.data = r.data; applyMeta(cur, r.data); refreshAll(); }
        }
      }
    } catch (_) {
      /* 定时刷新失败保持静默（与原行为一致）：
         它由时钟触发、不来自用户操作，弹「分析失败」只会让人以为是自己点坏了。
         真正的失败可见性由用户主动触发的路径（selectStock）负责。 */
    }
    state.timer = setTimeout(loop, state.refreshSec * 1000);
  }, state.refreshSec * 1000);
}

function marketStateText() {
  const n = new Date();
  const d = n.getDay();
  const hm = n.getHours() * 60 + n.getMinutes();
  const open = d >= 1 && d <= 5 && ((hm >= 570 && hm <= 690) || (hm >= 780 && hm <= 900));
  return open ? '● 交易中' : (d === 0 || d === 6) ? '○ 休市（周末）' : '○ 非交易时段';
}
function tickClock() {
  const n = new Date();
  $('#clock').textContent = n.toLocaleTimeString('zh-CN', { hour12: false });
  $('#marketState').textContent = marketStateText();
}

/* ============================ 事件绑定 ============================ */
/* 绑定规则：静态元素（index.html 里写死、不会被重新渲染的）直接绑；
   凡是可能被 renderXxx 重建的元素（胶囊、清单行、搜索行）一律走 document 委托。
   混用是这类应用最常见的事故源 —— 直接绑的那些在列表重建后就静默失效了。 */

$('#searchBtn').addEventListener('click', doSearch);
$('#searchInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
$('#searchInput').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(doSearch, 420); });
$$('#signalTabs .tab').forEach((t) => t.addEventListener('click', () => {
  $$('#signalTabs .tab').forEach((x) => x.classList.remove('active'));
  t.classList.add('active');
  state.tab = t.dataset.tab;
  renderSignals();
}));
$('#genReport').addEventListener('click', genReport);
/* 图表叠加层开关：按 **data-opt** 属性绑定，不再拼 id。
   原来写的是 `$('#tgl' + k[0].toUpperCase() + k.slice(1))` → 对 'ma' 拼出 `#tglMa`，
   而 HTML 里的 id 是 `tglMA` —— 大小写不匹配，`el` 为 null，
   于是「均线」开关从上线起就一直是死的（点了没反应，也不报错）。
   拼 id 这种做法一旦命名风格变了就会静默失效，改成声明式属性后由 HTML 自己描述绑定关系。 */
$$('.chart-toggles input[data-opt]').forEach((el) => {
  const key = el.getAttribute('data-opt');
  if (!(key in chartOpts)) return;
  el.checked = key === 'cross' ? !!chartOpts[key] : !!chartOpts[key];
  el.addEventListener('change', () => { chartOpts[key] = el.checked; redrawCharts(); });
});
['boll', 'rail', 'ma'].forEach((k) => {
  if (document.querySelector('.chart-toggles input[data-opt="' + k + '"]')) return;
  const el = $('#tgl' + k[0].toUpperCase() + k.slice(1));   // 兼容旧结构，保留一条退路
  if (el) el.addEventListener('change', () => { chartOpts[k] = el.checked; redrawCharts(); });
});

$('#refreshAll').addEventListener('click', async () => {
  await loadWatchlist();
  if (state.current) selectStock(state.current);
  else toast('已刷新');
});
$('#downloadMd').addEventListener('click', () => {
  if (!state.report) return;
  download(`${state.report.code}_${state.report.name}_投研持仓攻略.md`, state.report.md, 'text/markdown;charset=utf-8');
});
$('#downloadHtml').addEventListener('click', () => {
  if (!state.report) return;
  const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>${state.report.name} 投研报告</title>
<style>body{max-width:960px;margin:0 auto;padding:40px 24px;font:15px/1.75 -apple-system,"PingFang SC",sans-serif;color:#15171c}
h1{font-size:24px;border-bottom:3px solid #d0342c;padding-bottom:12px}h2{font-size:18px;border-left:4px solid #2450a4;padding-left:10px;margin-top:32px}
table{border-collapse:collapse;width:100%;font-size:13px;margin:12px 0}th,td{border:1px solid #e5e7eb;padding:7px 9px;text-align:left}
th{background:#f7f8fa}blockquote{background:#fafbfc;border-left:3px solid #d1d5db;padding:8px 14px;margin:10px 0;color:#4b5563}
hr{border:0;border-top:1px solid #e5e7eb;margin:24px 0}code{background:#f4f5f7;padding:1px 5px;border-radius:4px}</style>
</head><body>${state.report.bodyHtml || ''}</body></html>`;
  download(`${state.report.code}_${state.report.name}_投研持仓攻略.html`, html, 'text/html;charset=utf-8');
});

/* ---- 底部全屏清单：清单一层是静态 DOM，直接绑即可 ---- */
const _addBtn = $('#addBtn');
if (_addBtn) _addBtn.addEventListener('click', addStock);
const _addInput = $('#addInput');
if (_addInput) _addInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); addStock(); }
});
const _allSearch = $('#allSearch');
if (_allSearch) _allSearch.addEventListener('input', () => {
  state.q = _allSearch.value;   // 只重渲染清单，不惊动胶囊与详情
  renderAll();
});

/* ---- document 级委托：一次绑定，列表重建多少次都有效 ---- */
document.addEventListener('click', (e) => {
  const t = e.target;
  if (!t || !t.closest) return;

  /* 顺序即优先级：从最具体的按钮往外判断，最后才是「整行点击」 */
  const del = t.closest('[data-del]');
  if (del) { e.stopPropagation(); removeStock(del.getAttribute('data-del')); return; }

  const add = t.closest('[data-add]');
  if (add) { e.stopPropagation(); addByCode(add.getAttribute('data-add')); return; }

  if (t.closest('[data-cancel-search]')) { state.searchRows = null; refreshAll(); return; }

  if (t.closest('#chipAll')) { openSheet(true); return; }
  if (t.closest('#sheetClose') || t.closest('#sheetMask')) { openSheet(false); return; }

  const sb = t.closest('#allSorts button');
  if (sb) { state.sort = sb.getAttribute('data-sort'); renderAll(); return; }

  const ct = t.closest('.chart-toggle');
  if (ct) {
    const card = ct.closest('.chart-card');
    if (card) {
      const open = !chartIsOpen(card);
      setChartOpen(card, open);
      renderChartLabel();
      /* 展开后必须补画，而且要在**布局落定之后**画：
         折叠期间画布被 max-height 压成 0，某些引擎会把 clientWidth 记成上一次的测量值；
         跨断点、旋转屏幕后也会变。所以统一走 rAF —— 布局一定已经完成。 */
      if (open) {
        redrawCharts();                      // 先按当前宽度画一版
        requestAnimationFrame(() => repaintChartsIfPending(true));  // 若当时宽度还是 0，补一次
      } else {
        renderChartNotes();
      }
    }
    return;
  }

  const chip = t.closest('.watchlist [data-code]');
  if (chip) { applyPick(chip.getAttribute('data-code')); return; }

  const row = t.closest('.al-main[data-code]');
  if (row) { applyPick(row.getAttribute('data-code')); return; }
});

/* 键盘可达：Esc 收起清单；回车/空格触发带 role=button 的胶囊与清单行 */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.sheetOpen) { openSheet(false); return; }
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const t = e.target;
  if (!t || !t.getAttribute) return;
  const code = t.getAttribute('data-code');
  if (code && (t.classList.contains('wl-item') || t.classList.contains('al-main'))) {
    e.preventDefault();
    applyPick(code);
  }
});

/* ---- 内容区横滑换股 ----
   避开图表区与清单层：图表自己要吃横向手势，清单是固定层，
   不排除掉就会出现「想拖着看 K 线，结果股票被换掉」这种最恼人的误操作。 */
(function bindSwipe() {
  const box = document.querySelector('.content');
  if (!box) return;
  let sx = 0, sy = 0, lock = null;
  box.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { lock = 'no'; return; }
    if (e.target.closest && e.target.closest('.chart-card, .as-panel, .as-mask')) { lock = 'no'; return; }
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; lock = null;
  }, { passive: true });
  box.addEventListener('touchmove', (e) => {
    if (lock === 'no' || lock === 'v') return;
    const dx = e.touches[0].clientX - sx, dy = e.touches[0].clientY - sy;
    /* 先判方向再决定要不要截：横向分量明显大于纵向才认作换股手势，
       否则手指稍微斜一点就会把正常上下滚动变成换股 */
    if (lock === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      lock = Math.abs(dx) > Math.abs(dy) * 1.3 ? 'h' : 'v';
    }
  }, { passive: true });
  box.addEventListener('touchend', (e) => {
    if (lock === 'h') {
      const t0 = e.changedTouches[0];
      const dx = t0.clientX - sx, dy = t0.clientY - sy;
      if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
    }
    lock = null;
  }, { passive: true });
})();

/* 视口宽度变化：重画图表 + 跨断点时回到该端的默认态。
   防抖的理由：手机上拖动地址栏 / 软键盘弹出会连续触发 resize，
   每一帧都重画 120 根 K 线 + MACD 是白烧电。 */
let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    redrawCharts();
    if (pendingChartRepaint) requestAnimationFrame(() => repaintChartsIfPending());
    const narrow = isNarrow();
    if (narrow !== state.narrow) {
      state.narrow = narrow;
      if (!narrow && state.sheetOpen) state.sheetOpen = false;
      resetChartsForViewport();
      refreshAll();
      /* 跨断点会改变折叠态，宽度也可能在这一次布局里才确定，再补一帧 */
      requestAnimationFrame(() => repaintChartsIfPending(true));
    }
  }, 120);
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && state.current) selectStock(state.current);
});
/* 字体就绪后布局宽度可能微变，补画一次；同时兜住"首屏尺寸还没算出来"的情况 */
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => repaintChartsIfPending()).catch(() => {});
}
window.addEventListener('load', () => requestAnimationFrame(() => repaintChartsIfPending()));

/* ============================ 启动 ============================ */
(async function init() {
  const tag = $('#buildTag');
  if (tag) tag.textContent = BUILD_TAG;   // 远程排查时用来确认「对方拿到的是不是新版」
  tickClock();
  setInterval(tickClock, 1000);
  state.narrow = isNarrow();
  resetChartsForViewport();   // 显式落到当前端的默认折叠态，不依赖 CSS 初始值的巧合
  renderChartLabel();
  await loadWatchlist();
  startStream();
  const auto = state.list[0] && state.list[0].code;
  if (auto) selectStock(auto);
  else refreshAll();
})();
