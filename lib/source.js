'use strict';
/**
 * 多源行情数据层（同构：Node 服务端 + 浏览器静态版通用）
 * 主源：腾讯财经（qt.gtimg.cn / web.ifzq.gtimg.cn / proxy.finance.qq.com）—— 均已开放 CORS
 * 备源：新浪财经 hq.sinajs.cn、东方财富（仅 Node 可用，无 CORS）
 * 内置 TTL 缓存，避免高频轮询触发限流。
 */
const IS_NODE = typeof process !== 'undefined' && !!(process.versions && process.versions.node);

/* @node-only */
// cfg 仅在 Node 侧读取 secret，必须包进 @node-only，否则相对 require('./config')
// 会进入静态产物，既破坏「bundle.js 内不能有相对 require」的不变量，又会让
// 读取凭据的代码留在浏览器侧（且会在加载时抛错使整个模块失效）。
let nodeHttps = null, nodeZlib = null, cfg = null;
if (IS_NODE) {
  try { nodeHttps = require('https'); } catch (_) { nodeHttps = null; }
  try { nodeZlib = require('zlib'); } catch (_) { nodeZlib = null; }
  try { cfg = require('./config'); } catch (_) { cfg = null; }
}
/* @end-node-only */

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/* ------------------------------------------------------------------ */
/* 基础请求                                                            */
/* ------------------------------------------------------------------ */
function withTimeout(promise, ms, label, onTimeout) {
  let timer;
  const timeout = new Promise((_, rej) => {
    timer = setTimeout(() => {
      if (typeof onTimeout === 'function') onTimeout();
      rej(new Error(`timeout${label ? ' ' + label : ''}`));
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * 传输层健康状态。诊断面板会读它，用来判断「失败发生在哪一层」。
 * 之所以需要：静态版没有后端可查日志，只能靠浏览器自述。
 */
const transport = { fetchOk: 0, fetchFail: 0, jsonpOk: 0, jsonpFail: 0, lastTransport: '', lastError: '' };

function request(url, { headers = {}, timeout = 9000 } = {}) {
  // UA / Referer 在浏览器里属于 forbidden header，会被静默丢弃且毫无作用；
  // 只在 Node 侧带上，避免给 CORS 请求引入无意义的头。
  const h = IS_NODE ? { 'User-Agent': UA, 'Accept': '*/*', ...headers } : { 'Accept': '*/*' };

  // ---- 浏览器：直接 fetch（腾讯行情接口已开放 access-control-allow-origin: *）----
  if (!IS_NODE) {
    const controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    let settled = false;
    const p = fetch(url, {
      headers: h, referrerPolicy: 'no-referrer', mode: 'cors',
      signal: controller ? controller.signal : undefined
    }).then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status} @ ${url.slice(0, 90)}`);
      if (!settled) { transport.fetchOk++; transport.lastTransport = 'fetch'; }
      return new Uint8Array(await res.arrayBuffer());
    });
    // 超时 abort 后底层 fetch 会 reject，已由上层 .catch 处理，这里吞掉避免未处理拒绝
    p.catch(() => {});
    return withTimeout(p, timeout, `@ ${url.slice(0, 60)}`, controller ? () => controller.abort() : null)
      .catch((e) => { settled = true; transport.fetchFail++; transport.lastError = e.message; throw e; });
  }

  // ---- Node：原生 https（@node-only，不会进入浏览器产物）----
  /* @node-only */
  return new Promise((resolve, reject) => {
    if (!nodeHttps) return reject(new Error('https 模块不可用'));
    const req = nodeHttps.get(url, { headers: h }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(request(res.headers.location, { headers, timeout }));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        let buf = Buffer.concat(chunks);
        if (res.headers['content-encoding'] === 'gzip' && nodeZlib) { try { buf = nodeZlib.gunzipSync(buf); } catch (_) {} }
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} @ ${url.slice(0, 90)}`));
        resolve(buf);
      });
    });
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', reject);
    req.setTimeout(timeout);
  });
  /* @end-node-only */

  return Promise.reject(new Error('request(): 当前环境无可用传输层'));
}

/* ------------------------------------------------------------------ */
/* JSONP 兜底传输（仅浏览器）                                          */
/* ------------------------------------------------------------------ */
/**
 * 为什么需要：fetch 会死在很多真实环境里 —— 公司代理/防火墙、隐私与广告拦截
 * 插件（常整类拦掉第三方域名）、微信等 App 的内置浏览器、以及用 file:// 直接
 * 打开本地 HTML 的场合。而 <script> 标签既不受 CORS 约束，也基本不会被拦。
 * 腾讯三个接口都天然支持：q= 会写出全局 v_sz000063，ifzq 加 _var=NAME 包一层。
 *
 * 注意：脚本以「响应头声明的字符集」解码（qt 为 GBK、ifzq 为 UTF-8），
 * 所以走这条路反而绕开了 TextDecoder('gbk') 的浏览器兼容性问题。
 */
function jsonp(url, varName, timeout = 9000) {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') return reject(new Error('当前环境不支持 JSONP'));
    const script = document.createElement('script');
    let settled = false;
    const finish = (fn, arg) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (script.parentNode) script.parentNode.removeChild(script);
      try { delete window[varName]; } catch (_) { window[varName] = undefined; }
      fn(arg);
    };
    const timer = setTimeout(() => finish(reject, new Error(`jsonp 超时 @ ${url.slice(0, 70)}`)), timeout);
    script.onload = () => {
      const v = window[varName];
      if (v === undefined) finish(reject, new Error(`jsonp 未返回变量 ${varName}`));
      else finish(resolve, v);
    };
    script.onerror = () => finish(reject, new Error(`jsonp 加载失败 @ ${url.slice(0, 70)}`));
    script.src = url;
    script.async = true;
    document.head.appendChild(script);
  });
}

/** 把 "sz000063,sh600519" 拆成合法代码数组，过滤掉无法识别的部分 */
const splitTx = (txParam) => String(txParam).split(',')
  .map((s) => s.trim()).filter((tx) => /^[a-z]{2}\d{6}$/.test(tx));

/** 腾讯 JSONP 通道：逐只取回全局变量 v_xxNNNNNN，再还原成与 fetch 相同的文本形态 */
async function txSnapshotJsonp(txParam, timeout = 9000) {
  const list = splitTx(txParam);
  const parts = await Promise.all(list.map(async (tx) => {
    const v = await jsonp(`https://qt.gtimg.cn/q=${tx}`, `v_${tx}`, timeout);
    return v == null ? null : `v_${tx}="${String(v).replace(/"/g, '')}"`;
  }));
  const ok = parts.filter(Boolean);
  if (!ok.length) throw new Error('腾讯 JSONP 通道未取到任何数据');
  return ok.join(';');
}

/**
 * 新浪 JSONP 通道 —— 与腾讯**不同域名、不同 CDN**，是唯一能救「腾讯整域名不可达」
 * （运营商/企业 DNS 污染、防火墙按域名封锁、境外 CDN 抖动）的那条路。
 *
 * 为什么可行：hq.sinajs.cn 直接返回 `var hq_str_sz000063="..."`，
 * Content-Type 是 application/javascript，天然就是可被 <script> 执行的脚本，
 * 无需回调名参数；响应头声明 GB18030，浏览器按该字符集解码，中文名不会乱码。
 * 实测不带 Referer 也返回 200（历史上曾要求 Referer，故保留失败即降级的设计）。
 */
async function sinaSnapshotJsonp(txParam, timeout = 9000) {
  const list = splitTx(txParam);
  const parts = await Promise.all(list.map(async (tx) => {
    const v = await jsonp(`https://hq.sinajs.cn/list=${tx}`, `hq_str_${tx}`, timeout);
    // 无效代码时新浪返回空串，视为该只无数据
    return v == null || v === '' ? null : `hq_str_${tx}="${String(v).replace(/"/g, '')}"`;
  }));
  const ok = parts.filter(Boolean);
  if (!ok.length) throw new Error('新浪 JSONP 通道未取到任何数据');
  return ok.join(';');
}

/** 快照文本（v_xxNNNNNN="..."）：fetch 失败时逐只改用 JSONP 取回并还原成同样的文本形态 */
async function txSnapshotText(txParam, timeout = 9000) {
  try {
    return gbk(await request(`https://qt.gtimg.cn/q=${txParam}`, { timeout }));
  } catch (firstErr) {
    try {
      const text = await txSnapshotJsonp(txParam, timeout);
      transport.jsonpOk++; transport.lastTransport = 'jsonp';
      return text;
    } catch (_) {
      throw firstErr;   // 报错保持首个（fetch）原因，更贴近用户真实环境
    }
  }
}

/** ifzq 的 JSON 接口：fetch 失败时加 &_var=NAME 走 JSONP（直接得到对象） */
async function txJson(url, varName, timeout = 9000) {
  try {
    return JSON.parse(utf8(await request(url, { timeout })));
  } catch (firstErr) {
    try {
      const v = await jsonp(`${url}${url.includes('?') ? '&' : '?'}_var=${varName}`, varName, timeout);
      transport.jsonpOk++; transport.lastTransport = 'jsonp';
      return typeof v === 'string' ? JSON.parse(v) : v;
    } catch (e2) {
      transport.jsonpFail++;
      throw firstErr;
    }
  }
}

const gbk = (buf) => new TextDecoder('gbk').decode(buf);
const utf8 = (buf) => new TextDecoder('utf-8').decode(buf);

/* ------------------------------------------------------------------ */
/* 缓存                                                                */
/* ------------------------------------------------------------------ */
const cache = new Map();
const inflight = new Map();
const NEG_TTL = 2500; // 失败负缓存：高频轮询下避免对失败请求反复重试（重试风暴）
async function cached(key, ttl, fn) {
  const hit = cache.get(key);
  if (hit) {
    const age = Date.now() - hit.t;
    if (hit.neg) { if (age < NEG_TTL) throw hit.v; }
    else if (age < ttl) return hit.v;
  }
  if (inflight.has(key)) return inflight.get(key);
  const p = (async () => {
    try {
      const v = await fn();
      cache.set(key, { t: Date.now(), v, neg: false });
      return v;
    } catch (e) {
      cache.set(key, { t: Date.now(), v: e, neg: true });
      throw e;
    }
  })();
  inflight.set(key, p);
  try { return await p; }
  finally { inflight.delete(key); }
}

/* ------------------------------------------------------------------ */
/* 代码规范化                                                          */
/* ------------------------------------------------------------------ */
function normalize(code) {
  const c = String(code).trim().toUpperCase().replace(/^(SH|SZ|BJ)\.?/, '');
  let market;
  if (/^920\d{3}$/.test(c)) market = 'bj'; // 北交所新号段，须在 9xxxxx(沪B) 之前判断
  else if (/^6\d{5}$/.test(c) || /^5\d{5}$/.test(c) || /^9\d{5}$/.test(c)) market = 'sh';
  else if (/^[03]\d{5}$/.test(c) || /^1\d{5}$/.test(c)) market = 'sz';
  else if (/^[48]\d{5}$/.test(c)) market = 'bj';
  else market = null;
  return { code: c, market, secid: market ? `${market === 'sh' ? 1 : market === 'bj' ? 0 : 0}.${c}` : null, tx: market ? `${market}${c}` : null };
}

/* ------------------------------------------------------------------ */
/* 1. 实时快照                                                         */
/* ------------------------------------------------------------------ */
/**
 * 腾讯快照字段索引（v_xxx="..." 以 ~ 分隔）
 * 3 现价 | 4 昨收 | 5 今开 | 6 成交量(手) | 7 外盘 | 8 内盘
 * 9-28 五档 | 30 时间 | 31 涨跌 | 32 涨跌% | 33 最高 | 34 最低
 * 37 成交额(万) | 38 换手% | 39 PE(TTM) | 43 振幅% | 44 流通市值(亿)
 * 45 总市值(亿) | 46 PB | 47 涨停 | 48 跌停 | 49 量比 | 51 均价 | 52 PE(动)
 */
function parseTencentSnapshot(text) {
  const out = [];
  const re = /v_([a-z]{2}\d{6})="([^"]*)"/g;
  let m;
  while ((m = re.exec(text))) {
    const tx = m[1];
    const f = m[2].split('~');
    if (f.length < 50 || !f[1]) continue;
    const n = (i) => { const x = parseFloat(f[i]); return Number.isFinite(x) ? x : null; };
    out.push({
      code: f[2], market: tx.slice(0, 2), name: f[1],
      price: n(3), preClose: n(4), open: n(5),
      volume: n(6), outer: n(7), inner: n(8),
      time: f[30] ? `${f[30].slice(0, 4)}-${f[30].slice(4, 6)}-${f[30].slice(6, 8)} ${f[30].slice(8, 10)}:${f[30].slice(10, 12)}:${f[30].slice(12, 14)}` : '',
      change: n(31), changePct: n(32), high: n(33), low: n(34),
      amount: n(37) != null ? n(37) * 10000 : null,   // 元
      turnover: n(38), peTtm: n(39), amplitude: n(43),
      floatCap: n(44), totalCap: n(45), pb: n(46),
      limitUp: n(47), limitDown: n(48), volumeRatio: n(49),
      avgPrice: n(51), peDynamic: n(52), peStatic: n(53),
      bids: Array.from({ length: 5 }, (_, i) => ({ p: n(9 + i * 2), v: n(10 + i * 2) })),
      asks: Array.from({ length: 5 }, (_, i) => ({ p: n(19 + i * 2), v: n(20 + i * 2) })),
      source: 'tencent'
    });
  }
  return out;
}

function parseSinaSnapshot(text) {
  const out = [];
  const re = /hq_str_([a-z]{2}\d{6})="([^"]*)"/g;
  let m;
  while ((m = re.exec(text))) {
    const f = m[2].split(',');
    if (f.length < 32 || !f[0]) continue;
    const n = (i) => { const x = parseFloat(f[i]); return Number.isFinite(x) ? x : null; };
    const preClose = n(2), price = n(3);
    out.push({
      code: m[1].slice(2), market: m[1].slice(0, 2), name: f[0],
      price, preClose, open: n(1), high: n(4), low: n(5),
      volume: n(8), amount: n(9),
      change: price != null && preClose ? +(price - preClose).toFixed(3) : null,
      changePct: price != null && preClose ? +(((price - preClose) / preClose) * 100).toFixed(2) : null,
      time: `${f[30]} ${f[31]}`,
      turnover: null, peTtm: null, pb: null, volumeRatio: null,
      source: 'sina'
    });
  }
  return out;
}

async function getQuotes(codes) {
  const list = codes.map(normalize).filter((c) => c.tx);
  if (!list.length) return {};
  const txParam = list.map((c) => c.tx).sort().join(','); // 排序规范化缓存键，避免同组代码因顺序不同而重复缓存
  let rows = [];
  try {
    const text = await cached(`tx-snap:${txParam}`, 4000, () => txSnapshotText(txParam));
    rows = parseTencentSnapshot(text);
  } catch (e) {
    console.warn('[source] 腾讯快照失败，尝试降级：', e.message);
    // 降级链第三条：新浪。浏览器侧走 <script>（新浪无 CORS 头，fetch 必被拦），
    // Node 侧走原生 https + Referer。换域名是这里的关键 —— 腾讯整域名不通时才有救。
    if (typeof document !== 'undefined') {
      try {
        const text = await cached(`sina-jsonp:${txParam}`, 4000, () => sinaSnapshotJsonp(txParam));
        rows = parseSinaSnapshot(text);
        if (rows.length) { transport.jsonpOk++; transport.lastTransport = 'jsonp-sina'; }
      } catch (e2) { transport.jsonpFail++; console.warn('[source] 新浪 JSONP 降级也失败：', e2.message); }
    }
    /* @node-only */
    if (!rows.length && IS_NODE) {
      try {
        const buf = await cached(`sina-snap:${txParam}`, 4000, () =>
          request(`https://hq.sinajs.cn/list=${txParam}`, { headers: { Referer: 'https://finance.sina.com.cn' } }));
        rows = parseSinaSnapshot(gbk(buf));
      } catch (e3) { console.warn('[source] 新浪降级也失败：', e3.message); }
    }
    /* @end-node-only */
  }
  const map = {};
  rows.forEach((r) => { map[r.code] = r; });
  return map;
}

async function getQuote(code) {
  const map = await getQuotes([code]);
  return map[normalize(code).code] || null;
}

/* ------------------------------------------------------------------ */
/* 2. K 线                                                             */
/* ------------------------------------------------------------------ */
/** period: day | week | month */
async function getKline(code, period = 'day', count = 260) {
  const { code: c, tx } = normalize(code);
  const p = ['day', 'week', 'month'].includes(period) ? period : 'day';
  const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${tx},${p},,,${count},qfq`;
  const json = await cached(`k-${tx}-${p}-${count}`, 60000, () => txJson(url, `k_${tx}_${p}`));
  const node = json?.data?.[tx];
  if (!node) throw new Error(`无K线数据: ${code}`);
  const rows = node[`qfq${p}`] || node[p] || [];
  return rows.map((r) => ({
    date: r[0], open: +r[1], close: +r[2], high: +r[3], low: +r[4], volume: +r[5],
    amount: r[6] != null ? +r[6] : null
  })).filter((r) => Number.isFinite(r.close));
}

/* ------------------------------------------------------------------ */
/* 3. 分时                                                             */
/* ------------------------------------------------------------------ */
async function getMinutes(code) {
  const { tx } = normalize(code);
  const url = `https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=${tx}`;
  const json = await cached(`min-${tx}`, 15000, () => txJson(url, `min_${tx}`));
  const node = json?.data?.[tx];
  const preClose = +(node?.qt?.[tx]?.[4] ?? 0);
  const raw = node?.data?.data || [];
  const ticks = raw.map((line) => {
    const [t, price, vol, amt] = line.split(' ');
    return {
      time: `${t.slice(0, 2)}:${t.slice(2, 4)}`,
      price: +price, volume: +vol, amount: +amt
    };
  });
  return { preClose, ticks };
}

/* ------------------------------------------------------------------ */
/* 4. 资金流（分时主动买卖推算，第三方接口不可用时兜底）              */
/* ------------------------------------------------------------------ */
const fflowCache = new Map();
async function getFundFlow(code) {
  const { code: c, market, secid } = normalize(code);
  const key = `ff-${c}`;
  const hit = fflowCache.get(key);
  if (hit && Date.now() - hit.t < 60000) return hit.v;

  // 尝试东方财富（精确主力净流入）—— 该接口未开放 CORS，浏览器环境直接走分时估算
  let result = null;
  /* @node-only */
  if (IS_NODE) try {
    const url = `https://push2.eastmoney.com/api/qt/stock/fflow/kline/get?secid=${secid}`
      + `&fields1=f1,f2,f3,f7&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64,f65&klt=101&lmt=6`;
    const buf = await request(url, { timeout: 6000, headers: { Referer: 'https://data.eastmoney.com/' } });
    const json = JSON.parse(utf8(buf));
    const kl = json?.data?.klines || [];
    if (kl.length) {
      const series = kl.map((s) => {
        const f = s.split(',');
        return { date: f[0], main: +f[1], small: +f[2], medium: +f[3], large: +f[4], superLarge: +f[5] };
      });
      result = { source: 'eastmoney', today: series[series.length - 1], series };
    }
  } catch (_) { /* 降级 */ }
  /* @end-node-only */

  // 兜底：分时量价推算主动买卖（注意：腾讯分时的成交量/成交额为【累计值】，需先差分）
  if (!result) {
    try {
      const { ticks, preClose } = await getMinutes(code);
      let buy = 0, sell = 0, flat = 0;
      let prevVol = 0, prev = preClose || ticks[0]?.price || 0;
      for (const t of ticks) {
        const dv = Math.max(0, t.volume - prevVol);   // 本分钟增量（手）
        prevVol = t.volume;
        if (t.price > prev) buy += dv;
        else if (t.price < prev) sell += dv;
        else flat += dv;
        prev = t.price;
      }
      const avg = ticks.length ? ticks.reduce((s, t) => s + t.price, 0) / ticks.length : 0;
      const main = Math.round((buy - sell) * avg * 100);   // 元
      const total = buy + sell + flat || 1;
      result = {
        source: 'estimate',
        note: '基于分时逐分钟量价的主动买卖估算（第三方资金流接口不可用时启用）',
        today: {
          date: '', main, buyVolume: buy, sellVolume: sell, flatVolume: flat,
          avgPrice: +avg.toFixed(2), buyRatio: +((buy / total) * 100).toFixed(1)
        },
        series: [{ date: '', main }]
      };
    } catch (_) {
      result = { source: 'none', today: null, series: [] };
    }
  }
  fflowCache.set(key, { t: Date.now(), v: result });
  return result;
}

/* ------------------------------------------------------------------ */
/* 5. 股票搜索                                                         */
/* ------------------------------------------------------------------ */
/** 腾讯 smartbox 联想（JSONP，绕过 CORS；返回值形如 v_hint="sz~002422~科伦药业~klyy~GP-A^..."） */
function parseSmartbox(raw) {
  if (!raw || typeof raw !== 'string') return [];
  return raw.split('^').map((item) => {
    const f = item.split('~');
    if (f.length < 5) return null;
    const [mk, code, name, , type] = f;
    if (!['sh', 'sz', 'bj'].includes(mk)) return null;          // 只保留 A 股市场
    if (!/^GP/.test(type || '')) return null;                    // 只保留股票（排除基金/债券）
    return { code, name, market: mk, secid: `${mk === 'sh' ? 1 : 0}.${code}`, type: 'A股' };
  }).filter(Boolean);
}

// 串行锁：smartbox 接口固定写全局变量 v_hint，并发插入多个 <script> 时，
// 后加载的脚本会覆盖 window.v_hint，而 onload 是排队的任务，可能在「前一个脚本
// 已写入 v_hint 但还没轮到它的 onload 执行」之前就跑掉，导致两次搜索结果互相污染。
// 串行化可彻底消除该竞态（搜索本就低频/防抖，串行开销可忽略）。
let sbLock = Promise.resolve();
function jsonpSuggest(keyword, timeout = 4000) {
  const run = () => new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve([]);
    const s = document.createElement('script');
    let done = false;
    let timer = null;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      const raw = window.v_hint || '';
      try { delete window.v_hint; } catch (_) { window.v_hint = undefined; }
      s.remove();
      resolve(parseSmartbox(raw));
    };
    s.onload = finish;
    s.onerror = finish;
    s.src = `https://smartbox.gtimg.cn/s3/?v=2&t=all&q=${encodeURIComponent(keyword)}&_=${Date.now()}`;
    document.head.appendChild(s);
    timer = setTimeout(finish, timeout);
  });
  const p = sbLock.then(run, run);
  sbLock = p.then(() => {}, () => {});
  return p;
}

/**
 * 从 smartbox 原始响应中解出 v_hint 的内层值，再交给 parseSmartbox。
 * Node 端拿到的是完整文本 `v_hint="sz~002422~..."`；浏览器 JSONP 拿到的已是内层值。
 */
function parseSmartboxText(text) {
  const s = String(text || '');
  const m = s.match(/v_hint\s*=\s*"([^"]*)"/);
  return parseSmartbox(m ? m[1] : s);
}

/**
 * 腾讯 smartbox 联想搜索（默认路径，无需任何凭据）。
 * Node 端直接 HTTP 抓取并按 GBK 解码；浏览器端走 JSONP 绕过 CORS。
 * 两端共用同一个 parseSmartbox，行为一致。
 */
async function smartboxSuggest(kw) {
  const url = `https://smartbox.gtimg.cn/s3/?v=2&t=all&q=${encodeURIComponent(kw)}&_=${Date.now()}`;
  /* @node-only */
  try {
    const buf = await cached(`sb-${kw}`, 120000, () => request(url, { timeout: 6000 }));
    return parseSmartboxText(gbk(buf));
  } catch (_) {
    return [];
  }
  /* @end-node-only */
  return jsonpSuggest(kw);
}

async function searchStocks(keyword) {
  const kw = String(keyword || '').trim();
  if (!kw) return [];

  // 可选的增强路径：服务端另行配置了东方财富 token 时才启用（字段更全）。
  // 该分支整体位于 @node-only 区块内，打包成浏览器产物时会被剥离，token 不可能进入静态文件。
  /* @node-only */
  const emToken = cfg.secret('EASTMONEY_TOKEN');
  if (IS_NODE && emToken) {
    try {
      const url = `https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(kw)}`
        + `&type=14&token=${encodeURIComponent(emToken)}&count=10`;
      const buf = await cached(`search-${kw}`, 300000, () => request(url, { timeout: 6000 }));
      const json = JSON.parse(utf8(buf));
      const rows = json?.QuotationCodeTable?.Data || [];
      const out = rows
        .filter((r) => r.Classify === 'AStock' || r.Classify === 'Index' || r.SecurityType === '2')
        .map((r) => ({ code: r.Code, name: r.Name, market: r.QuoteID?.split('.')[0] === '1' ? 'sh' : 'sz', secid: r.QuoteID, type: r.SecurityTypeName }));
      if (out.length) return out;
    } catch (_) { /* 降级到 smartbox */ }
  }
  /* @end-node-only */

  const rows = await smartboxSuggest(kw);
  if (rows.length) return rows;

  // 最终兜底：能识别成 6 位代码就直接用
  const n = normalize(kw);
  return n.market ? [{ code: n.code, name: n.code, market: n.market, secid: n.secid, type: 'A股' }] : [];
}

/** 供诊断面板读取：失败究竟卡在传输层的哪一步 */
function transportInfo() {
  const used = transport.jsonpOk > 0 && transport.lastTransport === 'jsonp';
  const usedSina = transport.jsonpOk > 0 && transport.lastTransport === 'jsonp-sina';
  return {
    ...transport,
    usable: transport.fetchOk > 0 || transport.jsonpOk > 0,
    mode: usedSina ? 'jsonp-sina（腾讯不可达，已切新浪备源）'
      : used ? 'jsonp（fetch 被拦，已自动切换）'
        : (transport.fetchOk > 0 ? 'fetch（正常直连）' : '未成功取到任何数据')
  };
}

module.exports = {
  request, getQuotes, getQuote, getKline, getMinutes, getFundFlow, searchStocks,
  normalize, cached, gbk, utf8, parseSmartbox, parseSmartboxText, smartboxSuggest, IS_NODE,
  jsonp, txSnapshotText, txSnapshotJsonp, sinaSnapshotJsonp, txJson, transportInfo
};
