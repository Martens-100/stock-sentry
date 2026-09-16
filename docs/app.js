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

const state = { codes: [], current: null, data: null, timer: null, tab: 'bull', refreshSec: 8, report: null };

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
async function loadWatchlist() {
  const box = $('#watchlist');
  try {
    const r = await api('/api/watchlist');
    state.codes = r.codes;
    state.refreshSec = r.refreshSec || 8;
    $('#refreshSec').textContent = state.refreshSec;
    $('#wlCount').textContent = r.list.length;
    box.innerHTML = r.list.map((it) => {
      const q = it.quote || {};
      const c = q.changePct;
      return `<div class="wl-item ${state.current === it.code ? 'active' : ''}" data-code="${it.code}">
        <div class="wl-row1">
          <span class="wl-name">${it.name}
            ${it.hasProfile ? '<span class="tag" style="font-size:10px">画像</span>' : ''}
          </span>
          <button class="wl-del" data-del="${it.code}" title="移除">✕</button>
        </div>
        <div class="wl-row2">
          <span class="wl-code">${it.code}</span>
          <span><span class="wl-price ${cls(c)}">${q.price != null ? fmt(q.price) : '—'}</span>
          <span class="wl-chg ${cls(c)}"> ${sign(c)}%</span></span>
        </div>
      </div>`;
    }).join('') || '<div class="empty-hint">暂无自选股，请在上方搜索添加</div>';

    box.querySelectorAll('.wl-item').forEach((el) => {
      el.addEventListener('click', (e) => {
        if (e.target.dataset.del) return;
        selectStock(el.dataset.code);
      });
    });
    box.querySelectorAll('.wl-del').forEach((b) => {
      b.addEventListener('click', async (e) => {
        e.stopPropagation();
        await api('/api/watchlist', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ remove: b.dataset.del })
        });
        if (state.current === b.dataset.del) { state.current = null; $('#detail').hidden = true; $('#empty').hidden = false; }
        toast('已移除 ' + b.dataset.del);
        loadWatchlist();
      });
    });
  } catch (e) {
    box.innerHTML = `<div class="loading">加载失败：${e.message}</div>`;
  }
}

/* ============================ 搜索 ============================ */
let searchTimer = null;
async function doSearch() {
  const q = $('#searchInput').value.trim();
  const box = $('#searchResults');
  if (!q) { box.innerHTML = ''; return; }
  try {
    const r = await api('/api/search?q=' + encodeURIComponent(q));
    box.innerHTML = (r.rows || []).map((x) =>
      `<div class="sr-item" data-code="${x.code}">
         <span class="sr-name">${x.name}</span>
         <span class="sr-meta">${x.code} · ${x.type || ''} <b style="color:var(--accent)">+ 添加</b></span>
       </div>`).join('') || '<div class="empty-hint">未找到匹配标的</div>';
    box.querySelectorAll('.sr-item').forEach((el) => el.addEventListener('click', async () => {
      await api('/api/watchlist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ add: el.dataset.code })
      });
      toast('已添加到自选：' + el.dataset.code);
      box.innerHTML = '';
      $('#searchInput').value = '';
      await loadWatchlist();
      selectStock(el.dataset.code);
    }));
  } catch (e) { box.innerHTML = `<div class="empty-hint">搜索失败：${e.message}</div>`; }
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
const BUILD_TAG = 'v1.1';

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
  box.innerHTML = `<div class="diag">
    <h3>⚠️ 分析失败 · 诊断面板</h3>
    <p class="diag-cause">${guessCause(err)}</p>
    <table class="diag-tb">
      <tr><td>标的</td><td><code>${esc(code || '—')}</code></td></tr>
      <tr><td>错误类型</td><td><code>${esc((err && err.name) || 'Error')}</code></td></tr>
      <tr><td>错误信息</td><td><code>${esc((err && err.message) || String(err))}</code></td></tr>
      ${envFacts().map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`).join('')}
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
  $('#diagReload').addEventListener('click', () => location.reload());
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
async function selectStock(code) {
  state.current = code;
  $$('.wl-item').forEach((el) => el.classList.toggle('active', el.dataset.code === code));
  $('#empty').hidden = true;
  $('#detail').hidden = false;
  clearDiag();
  try {
    const r = await api('/api/analyze?code=' + encodeURIComponent(code));
    if (!r.ok) throw new Error(r.error);
    state.data = r.data;
    renderDetail(r.data);
  } catch (e) {
    $('#detail').hidden = true;
    toast('分析失败：' + e.message);
    // 诊断面板自己会说明原因，比干瘪的「选择标的」占位有用得多
    $('#empty').hidden = showDiag(e, code);
    console.error(e);
  }
}

function renderDetail(d) {
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
  const items = [
    ['建仓区间', p.entry?.[0] ? `${p.entry[0]} ~ ${p.entry[1]}` : '—'],
    ['第一目标位', p.target1 ?? '—'],
    ['第二目标位', p.target2 ?? '—'],
    ['止损位', p.stopLoss ?? '—'],
    ['硬止损位', p.hardStop ?? '—'],
    ['盈亏比', p.riskReward ? p.riskReward + ' : 1' : '—'],
    ['建议仓位上限', p.positionLimitPct + '%'],
    ['ATR(14)', `${p.atr}（${p.atrPct}%）`],
    ['距止损空间', p.stopLoss ? fmt(((q.price - p.stopLoss) / q.price) * 100) + '%' : '—'],
    ['距目标空间', p.target1 ? fmt(((p.target1 - q.price) / q.price) * 100) + '%' : '—']
  ];
  $('#planGrid').innerHTML = items.map(([k, v]) => `<div class="pg-item"><span>${k}</span><b>${v}</b></div>`).join('')
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

  /* 报告区重置 */
  state.report = null;
  $('#downloadHtml').disabled = true;
  $('#downloadMd').disabled = true;

  renderChannel(d.ind);
  drawMinute(d.chart);
  drawKline(d.chart, d.ind);
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
        <span class="sig-name">${s.name}</span>
        <span class="sig-dim">${s.dim}</span>
        <span class="sig-stars">${'★'.repeat(Math.max(1, Math.min(5, Math.round(s.strength))))}</span>
        <span class="sig-dim">权重 ${s.weight}</span>
        ${s.origin === 'profile' ? '<span class="tag" style="font-size:10px">画像规则</span>' : ''}
      </div>
      <div class="sig-text">${s.text}</div>
      <div class="sig-evi">📊 ${s.evidence}</div>
    </div>`).join('') || '<div class="hint">暂无该类信号</div>';
}

/* ============================ 轨道研判 ============================ */
const hexA = (hex, a) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
const clampN = (x, a, b) => Math.min(b, Math.max(a, x));

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

function renderChannel(ind) {
  const v = ind.channelVerdict;
  const box = $('#chGrid');
  if (!v) { box.innerHTML = '<div class="hint">轨道数据不可用</div>'; return; }

  const z = $('#chZone');
  z.textContent = v.zone;
  z.style.background = hexA(v.color, .10);
  z.style.color = v.color;
  const ad = $('#chAdvice');
  ad.textContent = v.advice;
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

  const rows = [];
  if (bi) rows.push(railRow('布林轨道', v.boll.dn, v.boll.up, v.boll.mid, bi.pctB, '#7e57c2', fmt(ind.price), v.bollLabel));
  if (ra && ra.up > ra.dn) rows.push(railRow('回归导轨', ra.dn, ra.up, ra.mid, ra.pctChan, '#ff9800', fmt(ind.price), v.railPosLabel));
  if (dc) rows.push(railRow('唐奇安区间', dc.lower, dc.upper, dc.mid, dc.pct / 100, '#0288d1', fmt(ind.price), `区间 ${dc.pct}%`));
  $('#railViz').innerHTML = rows.join('');
}

/* ============================ 图表 ============================ */
function setupCanvas(cv, h) {
  const dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth || cv.parentElement.clientWidth;
  cv.width = w * dpr;
  cv.height = h * dpr;
  cv.style.height = h + 'px';
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}
const COL = {
  up: '#d0342c', down: '#12855a', grid: '#eef0f3', ink: '#7a828f', line: '#2450a4', avg: '#e6a23c',
  ma5: '#e6a23c', ma10: '#2450a4', ma20: '#8e44ad', ma60: '#12855a',
  bollUp: '#e91e63', bollMid: '#b39ddb', bollDn: '#00acc1', rail: '#ff9800'
};
const chartOpts = { boll: true, rail: true, ma: true, cross: null };

function drawMinute(chart) {
  const cv = $('#minuteChart');
  const { ctx, w, h } = setupCanvas(cv, 220);
  const padL = 52, padR = 56, padT = 12, padB = 34;
  const cw = w - padL - padR, chh = h - padT - padB;
  const ticks = chart.minutes || [];
  const preClose = chart.preClose;

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
  const { ctx, w, h } = setupCanvas(cv, 380);
  const padL = 52, padR = 16, padT = 10, padB = 22;
  const cw = w - padL - padR;
  const k = chart.kline || [];
  if (!k.length) return;

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

  /* ---- 轨道序列对齐（导轨只覆盖最近 bars 根） ---- */
  const boll = chartOpts.boll ? chart.boll : null;
  const rail = chartOpts.rail && chart.rails ? chart.rails : null;
  const railOffset = rail ? Math.max(0, k.length - rail.bars) : 0;

  const rangeVals = [...k.map((x) => x.high), ...k.map((x) => x.low)];
  if (boll) { [boll.up, boll.dn].forEach((arr) => arr.forEach((v) => { if (v != null) rangeVals.push(v); })); }
  if (rail) { [rail.up, rail.dn].forEach((arr) => arr.forEach((v) => { if (v != null) rangeVals.push(v); })); }
  const hi = Math.max(...rangeVals);
  const lo = Math.min(...rangeVals);
  const pad = (hi - lo) * 0.05;
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
    ctx.fillText(k[i].date.slice(5), X(i), y3 + h3 + 16));

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

  /* ---- 布林上下轨 ---- */
  if (boll && boll.up && boll.dn) {
    pathFill(boll.up, boll.dn, 'rgba(126,87,194,.07)');
    pathLine(boll.up, COL.bollUp, 1.1);
    pathLine(boll.dn, COL.bollDn, 1.1);
    pathLine(boll.mid, COL.bollMid, 1, [4, 3]);
  }

  /* ---- 回归导轨通道 ---- */
  if (rail && rail.up && rail.dn) {
    pathFill(rail.up, rail.dn, 'rgba(255,152,0,.09)', railOffset);
    pathLine(rail.up, COL.rail, 1.3, [6, 3], railOffset);
    pathLine(rail.dn, COL.rail, 1.3, [6, 3], railOffset);
    pathLine(rail.mid, 'rgba(255,152,0,.75)', 1, [2, 3], railOffset);
  }

  // ---- 均线 ----
  if (chartOpts.ma) {
    pathLine(ma5, COL.ma5, 1); pathLine(ma10, COL.ma10, 1);
    pathLine(ma20, COL.ma20, 1.2); pathLine(ma60, COL.ma60, 1.2);
  }

  // ---- 成交量 ----
  const maxV = Math.max(...k.map((x) => x.volume));
  k.forEach((bar, i) => {
    const bh = (bar.volume / maxV) * h2;
    ctx.fillStyle = bar.close >= bar.open ? 'rgba(208,52,44,.60)' : 'rgba(18,133,90,.60)';
    ctx.fillRect(X(i) - bw / 2, y2 + h2 - bh, bw, bh);
  });
  ctx.strokeStyle = COL.grid; ctx.beginPath(); ctx.moveTo(padL, y2 + h2); ctx.lineTo(padL + cw, y2 + h2); ctx.stroke();

  // ---- MACD ----
  const dif = chart.macd?.dif?.slice(-k.length) || [];
  const dea = chart.macd?.dea?.slice(-k.length) || [];
  const hist = chart.macd?.hist?.slice(-k.length) || [];
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

/* ============================ 实时刷新 ============================ */
function startStream() {
  if (state.timer) clearInterval(state.timer);
  state.timer = setInterval(async () => {
    if (!$('#autoRefresh').checked) return;
    if (document.hidden) return;
    await loadWatchlist();
    if (state.current) {
      try {
        const r = await api('/api/analyze?code=' + encodeURIComponent(state.current));
        if (r.ok) { state.data = r.data; renderDetail(r.data); }
      } catch (_) {}
    }
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
['boll', 'rail', 'ma'].forEach((k) => {
  const el = $('#tgl' + k[0].toUpperCase() + k.slice(1));
  if (el) el.addEventListener('change', () => { chartOpts[k] = el.checked; redrawCharts(); });
});
$('#refreshAll').addEventListener('click', async () => {
  await loadWatchlist();
  if (state.current) selectStock(state.current);
  toast('已刷新');
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
window.addEventListener('resize', () => redrawCharts());
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && state.current) selectStock(state.current);
});

/* ============================ 启动 ============================ */
(async function init() {
  const tag = $('#buildTag');
  if (tag) tag.textContent = BUILD_TAG;   // 远程排查时用来确认「对方拿到的是不是新版」
  tickClock();
  setInterval(tickClock, 1000);
  await loadWatchlist();
  startStream();
  const auto = state.codes[0];
  if (auto) selectStock(auto);
})();
