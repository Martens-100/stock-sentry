'use strict';
/** 技术指标计算引擎（纯函数，无依赖） */

const S = (a, n) => a.slice(-n);
const last = (a) => (a.length ? a[a.length - 1] : null);
const round = (x, d = 3) => (Number.isFinite(x) ? +x.toFixed(d) : null);

function sma(arr, n) {
  const out = new Array(arr.length).fill(null);
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i];
    if (i >= n) sum -= arr[i - n];
    if (i >= n - 1) out[i] = sum / n;
  }
  return out;
}

function ema(arr, n) {
  const out = new Array(arr.length).fill(null);
  const k = 2 / (n + 1);
  let prev = null;
  for (let i = 0; i < arr.length; i++) {
    prev = prev == null ? arr[i] : arr[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** MACD(12,26,9) */
function macd(closes, fast = 12, slow = 26, signal = 9) {
  const ef = ema(closes, fast), es = ema(closes, slow);
  const dif = closes.map((_, i) => (ef[i] != null && es[i] != null ? ef[i] - es[i] : null)).filter((x) => x != null);
  const dea = ema(dif, signal);
  const hist = dif.map((d, i) => (dea[i] != null ? (d - dea[i]) * 2 : null));
  return { dif, dea, hist };
}

/** RSI(14) Wilder 平滑 */
function rsi(closes, n = 14) {
  const out = new Array(closes.length).fill(null);
  let gain = 0, loss = 0;
  for (let i = 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const g = Math.max(d, 0), l = Math.max(-d, 0);
    if (i <= n) {
      gain += g / n; loss += l / n;
      if (i === n) out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
    } else {
      gain = (gain * (n - 1) + g) / n;
      loss = (loss * (n - 1) + l) / n;
      out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
    }
  }
  return out;
}

/** KDJ(9,3,3) */
function kdj(highs, lows, closes, n = 9) {
  const K = [], D = [], J = [];
  let k = 50, d = 50;
  for (let i = 0; i < closes.length; i++) {
    if (i < n - 1) { K.push(null); D.push(null); J.push(null); continue; }
    const hh = Math.max(...highs.slice(i - n + 1, i + 1));
    const ll = Math.min(...lows.slice(i - n + 1, i + 1));
    const rsv = hh === ll ? 50 : ((closes[i] - ll) / (hh - ll)) * 100;
    k = (2 / 3) * k + (1 / 3) * rsv;
    d = (2 / 3) * d + (1 / 3) * k;
    K.push(k); D.push(d); J.push(3 * k - 2 * d);
  }
  return { k: K, d: D, j: J };
}

/** BOLL(20,2) */
function boll(closes, n = 20, k = 2) {
  const mid = sma(closes, n);
  const up = [], dn = [];
  for (let i = 0; i < closes.length; i++) {
    if (mid[i] == null) { up.push(null); dn.push(null); continue; }
    const win = closes.slice(i - n + 1, i + 1);
    const mean = mid[i];
    const sd = Math.sqrt(win.reduce((s, x) => s + (x - mean) ** 2, 0) / n);
    up.push(mean + k * sd); dn.push(mean - k * sd);
  }
  return { mid, up, dn };
}

/** ATR(14) */
function atr(highs, lows, closes, n = 14) {
  const tr = [null];
  for (let i = 1; i < closes.length; i++) {
    tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
  }
  const out = new Array(closes.length).fill(null);
  let prev = null;
  for (let i = 1; i < tr.length; i++) {
    if (i < n) { prev = tr.slice(1, i + 1).reduce((s, x) => s + x, 0) / i; }
    else prev = (prev * (n - 1) + tr[i]) / n;
    out[i] = prev;
  }
  return out;
}

/** 摆动高低点（用于支撑/阻力位） */
function pivots(kline, span = 5, lookback = 120) {
  const ks = kline.slice(-lookback);
  const highs = [], lows = [];
  for (let i = span; i < ks.length - span; i++) {
    const w = ks.slice(i - span, i + span + 1);
    if (ks[i].high === Math.max(...w.map((x) => x.high))) highs.push(ks[i].high);
    if (ks[i].low === Math.min(...w.map((x) => x.low))) lows.push(ks[i].low);
  }
  return { highs, lows };
}

/** 关键价位聚类：按 1.5% 容差合并，按重要性排序 */
function keyLevels(kline, price) {
  const { highs, lows } = pivots(kline);
  const all = [...highs.map((v) => ({ v, t: 'R' })), ...lows.map((v) => ({ v, t: 'S' }))];
  const clusters = [];
  all.sort((a, b) => a.v - b.v).forEach((p) => {
    const c = clusters.find((x) => Math.abs(x.v - p.v) / p.v < 0.015);
    if (c) { c.n++; c.v = (c.v * (c.n - 1) + p.v) / c.n; } else clusters.push({ v: p.v, n: 1, t: p.t });
  });
  return clusters
    .filter((c) => c.n >= 2)
    .map((c) => ({ price: +c.v.toFixed(2), count: c.n, side: c.v >= price ? 'resistance' : 'support', dist: +(((c.v - price) / price) * 100).toFixed(2) }))
    .sort((a, b) => b.count - a.count);
}

/** 线性回归导轨通道：对近 N 根收盘价做最小二乘拟合，上下轨 = 回归值 ± k×残差标准差
 *  自适应窗口：优先 60 根(k=2)，若通道过宽则依次缩短窗口/收窄倍数，保证导轨可解读 */
function regressionChannel(kline, k = 2, n = 60) {
  const candidates = [
    { n: 60, k: 2.0 }, { n: 45, k: 1.8 }, { n: 30, k: 1.6 }, { n: 20, k: 1.5 }
  ];
  let out = null;
  for (const cfg of candidates) {
    out = fitChannel(kline, cfg.k, cfg.n);
    if (out && out.widthPct <= 30) { out.reliable = true; return out; }
  }
  if (out) out.reliable = false;
  return out;
}

function fitChannel(kline, k, n) {
  const seg = kline.slice(-Math.min(n, kline.length));
  const N = seg.length;
  if (N < 12) return null;
  const ys = seg.map((x) => x.close);
  const xbar = (N - 1) / 2;
  const ybar = ys.reduce((a, b) => a + b, 0) / N;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < N; i++) { sxy += (i - xbar) * (ys[i] - ybar); sxx += (i - xbar) ** 2; }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = ybar - slope * xbar;
  const fit = ys.map((_, i) => intercept + slope * i);
  const resid = ys.map((y, i) => y - fit[i]);
  const ss = Math.sqrt(resid.reduce((a, r) => a + r * r, 0) / Math.max(1, N - 2));

  const mid = [], up = [], dn = [];
  for (let i = 0; i < N; i++) {
    mid.push(fit[i]);
    up.push(fit[i] + k * ss);
    dn.push(fit[i] - k * ss);
  }
  const iL = N - 1;
  const P = ys[iL];
  const width = up[iL] - dn[iL];
  const pctChan = width > 0 ? (P - dn[iL]) / width : 0.5;
  const slope20Pct = (slope * 20 / P) * 100;
  const dir = slope20Pct > 1.5 ? 'up' : slope20Pct < -1.5 ? 'down' : 'flat';

  const near = (which, tol = 0.18) => {
    let c = 0;
    for (let i = Math.max(0, N - 10); i < N; i++) {
      const w = up[i] - dn[i];
      if (w > 0) {
        const pos = (ys[i] - dn[i]) / w;
        if (which === 'up' && pos > 1 - tol) c++;
        if (which === 'dn' && pos < tol) c++;
      }
    }
    return c;
  };

  return {
    k, slope: +slope.toFixed(4), slope20Pct: +slope20Pct.toFixed(2), dir,
    std: +ss.toFixed(3), width: +width.toFixed(2),
    widthPct: +((width / P) * 100).toFixed(2),
    mid: +mid[iL].toFixed(2), up: +up[iL].toFixed(2), dn: +dn[iL].toFixed(2),
    pctChan: +Math.max(-0.6, Math.min(1.6, pctChan)).toFixed(3),
    nearUpper: near('up'), nearLower: near('dn'),
    bars: N, reliable: true,
    series: { mid, up, dn, dates: seg.map((x) => x.date) }
  };
}

/** 布林带状态：带宽分位、%B、收口/开口 */
function bollState(closes, up, mid, dn, price) {
  const iL = closes.length - 1;
  const width = up[iL] - dn[iL];
  const bandwidth = mid[iL] ? width / mid[iL] : null;
  const pctB = width > 0 ? (price - dn[iL]) / width : 0.5;

  const hist = [];
  for (let i = Math.max(0, closes.length - 120); i < closes.length; i++) {
    if (up[i] != null && mid[i]) hist.push((up[i] - dn[i]) / mid[i]);
  }
  const below = hist.filter((x) => x < bandwidth).length;
  const bandwidthPctile = hist.length ? +((below / hist.length) * 100).toFixed(0) : null;
  const state = bandwidthPctile == null ? 'normal'
    : bandwidthPctile <= 20 ? 'squeeze' : bandwidthPctile >= 80 ? 'expand' : 'normal';

  return {
    bandwidth: bandwidth != null ? +bandwidth.toFixed(4) : null,
    bandwidthPct: bandwidth != null ? +(bandwidth * 100).toFixed(2) : null,
    bandwidthPctile, pctB: +pctB.toFixed(3), state,
    stateLabel: state === 'squeeze' ? '收口（变盘临近）' : state === 'expand' ? '开口（趋势加速）' : '常态',
    series: { up, mid, dn }
  };
}

/** 唐奇安通道（区间导轨） */
function donchian(kline, n = 20) {
  const seg = kline.slice(-(n + 1), -1);
  if (seg.length < 5) return null;
  const upper = Math.max(...seg.map((x) => x.high));
  const lower = Math.min(...seg.map((x) => x.low));
  const P = kline[kline.length - 1].close;
  const w = upper - lower;
  return {
    upper: +upper.toFixed(2), lower: +lower.toFixed(2), mid: +((upper + lower) / 2).toFixed(2),
    pct: w > 0 ? +(((P - lower) / w) * 100).toFixed(1) : 50, window: seg.length
  };
}

/** 轨道综合研判：把布林上下轨位置与导轨方向组合成可执行的区间判断 */
function channelVerdict(ind) {
  const P = ind.price;
  const bi = ind.bollInfo;
  const ra = ind.rails;
  const dc = ind.donchian;
  const pos = bi?.pctB ?? 0.5;

  let bollPos, bollLabel;
  if (pos >= 1) { bollPos = 'above_upper'; bollLabel = '上轨之上（超买区）'; }
  else if (pos >= 0.8) { bollPos = 'upper'; bollLabel = '上轨附近（强势区）'; }
  else if (pos > 0.5) { bollPos = 'mid_up'; bollLabel = '中轨上方（偏强区）'; }
  else if (pos > 0.2) { bollPos = 'mid_dn'; bollLabel = '中轨下方（偏弱区）'; }
  else if (pos > 0) { bollPos = 'lower'; bollLabel = '下轨附近（弱势区）'; }
  else { bollPos = 'below_lower'; bollLabel = '下轨之下（超跌区）'; }

  const rp = ra?.pctChan ?? 0.5;
  const railPosLabel = rp > 1 ? '上轨之外' : rp >= 0.75 ? '通道上沿' : rp >= 0.45 ? '通道中上部'
    : rp >= 0.2 ? '通道中下部' : rp >= 0 ? '通道下沿' : '下轨之外';
  const railDirLabel = ra ? (ra.dir === 'up' ? '上升导轨' : ra.dir === 'down' ? '下降导轨' : '水平导轨（箱体）') : '—';

  let zone, color, advice;
  if (!ra || !ra.reliable) {
    zone = '导轨有效性不足';
    color = '#7a828f';
    advice = '当前波动结构分散，回归通道宽度过大、参考意义有限，建议以布林带与唐奇安区间为主进行区间判断。';
  } else if (ra.dir === 'up' && rp < 0.45) {
    zone = '上升导轨 · 回调低吸区';
    color = '#d0342c';
    advice = `上升导轨未破坏，价格回落至${railPosLabel}，属通道内低吸区间；止损参考导轨下轨 ${ra.dn}，目标看向导轨上轨 ${ra.up}。`;
  } else if (ra.dir === 'up' && rp >= 0.75) {
    zone = '上升导轨 · 上沿持有区';
    color = '#e0803a';
    advice = `价格贴近导轨上沿运行，趋势强但短期赔率下降；宜持有并上移止盈，不宜在此位置追加仓位。`;
  } else if (ra.dir === 'down' && rp <= 0.2) {
    zone = '下降导轨 · 下沿回避区';
    color = '#1b5e20';
    advice = `处于下降导轨下沿（现 ${P}，下轨 ${ra.dn}），属下跌通道末端但趋势未反转，不宜盲目抄底；需先看到中轨 ${ra.mid} 被收复。`;
  } else if (ra.dir === 'down' && rp >= 0.75) {
    zone = '下降导轨 · 上沿减仓区';
    color = '#12855a';
    advice = `价格反抽至下降导轨上沿（上轨 ${ra.up}），是通道内减仓窗口而非突破买点，除非放量收于上轨之上。`;
  } else if (ra.dir === 'flat' && rp <= 0.25) {
    zone = '水平导轨 · 箱底承接区';
    color = '#d0342c';
    advice = `箱体震荡（${ra.dn} ~ ${ra.up}）且价格位于箱底，适合区间低吸，止损设于箱底下方，目标为箱顶。`;
  } else if (ra.dir === 'flat' && rp >= 0.75) {
    zone = '水平导轨 · 箱顶减持区';
    color = '#12855a';
    advice = `箱体震荡且价格位于箱顶，冲高动能有限，适合区间减持，回落到箱底再考虑接回。`;
  } else {
    zone = `${railDirLabel} · 通道中部观望区`;
    color = '#b4740a';
    advice = `价格位于${railPosLabel}，方向未选择；建议等待触及通道上沿（${ra.up}）或下沿（${ra.dn}）再行动，中部不追不杀。`;
  }

  return {
    bollPos, bollLabel, railDirLabel, railPosLabel, zone, color, advice,
    squeeze: bi?.state === 'squeeze', reliable: !!ra?.reliable,
    boll: { up: ind.boll.up, mid: ind.boll.mid, dn: ind.boll.dn },
    rail: ra ? { up: ra.up, mid: ra.mid, dn: ra.dn, dir: ra.dir, bars: ra.bars, k: ra.k } : null,
    donchian: dc
  };
}

/** 主入口：一次性算出全部指标 */
function computeIndicators(kline, quote) {
  const closes = kline.map((k) => k.close);
  const highs = kline.map((k) => k.high);
  const lows = kline.map((k) => k.low);
  const vols = kline.map((k) => k.volume);
  const price = quote?.price ?? last(closes);

  const ma = {};
  [5, 10, 20, 30, 60, 120, 250].forEach((n) => { ma[`ma${n}`] = round(last(sma(closes, n))); });

  const m = macd(closes);
  const r = rsi(closes, 14);
  const k = kdj(highs, lows, closes, 9);
  const b = boll(closes, 20, 2);
  const a = atr(highs, lows, closes, 14);

  const n = closes.length;
  const iL = n - 1;
  const win = (arr, back) => arr.slice(Math.max(0, n - back - 1), n - 1); // 不含今日
  const prevVol5 = win(vols, 5);
  const avgVol5 = prevVol5.length ? prevVol5.reduce((s, x) => s + x, 0) / prevVol5.length : null;
  const avgVol20 = (() => { const w = win(vols, 20); return w.length ? w.reduce((s, x) => s + x, 0) / w.length : null; })();

  const high52 = Math.max(...kline.slice(-250).map((x) => x.high));
  const low52 = Math.min(...kline.slice(-250).map((x) => x.low));
  const high20 = Math.max(...kline.slice(-21, -1).map((x) => x.high));
  const low20 = Math.min(...kline.slice(-21, -1).map((x) => x.low));

  const atrVal = last(a);
  const ret = (back) => (n > back ? +(((price - closes[n - 1 - back]) / closes[n - 1 - back]) * 100).toFixed(2) : null);
  const maArrangement = (() => {
    const v = [ma.ma5, ma.ma10, ma.ma20, ma.ma60];
    if (v.some((x) => x == null)) return 'unknown';
    if (v[0] > v[1] && v[1] > v[2] && v[2] > v[3]) return 'bull';
    if (v[0] < v[1] && v[1] < v[2] && v[2] < v[3]) return 'bear';
    return 'mixed';
  })();

  const out = {
    price: round(price, 2),
    ma, macd: { dif: round(last(m.dif)), dea: round(last(m.dea)), hist: round(last(m.hist)), prevHist: round(m.hist[m.hist.length - 2]) },
    macdSeries: { dif: m.dif, dea: m.dea, hist: m.hist },
    rsi: round(last(r), 2), rsiPrev: round(r[r.length - 2], 2),
    kdj: { k: round(last(k.k), 2), d: round(last(k.d), 2), j: round(last(k.j), 2), prevK: round(k.k[k.k.length - 2], 2), prevD: round(k.d[k.d.length - 2], 2) },
    boll: { up: round(last(b.up), 2), mid: round(last(b.mid), 2), dn: round(last(b.dn), 2), series: b },
    bollInfo: bollState(closes, b.up, b.mid, b.dn, price),
    rails: regressionChannel(kline, 2, 60),
    donchian: donchian(kline, 20),
    atr: round(atrVal, 3),
    atrPct: atrVal ? round((atrVal / price) * 100, 2) : null,
    avgVol5: avgVol5 ? Math.round(avgVol5) : null,
    avgVol20: avgVol20 ? Math.round(avgVol20) : null,
    volRatioLocal: avgVol5 ? round(last(vols) / avgVol5, 2) : null,
    position52: +(((price - low52) / (high52 - low52)) * 100).toFixed(1),
    drawdownFromHigh: +(((price - high52) / high52) * 100).toFixed(2),
    high52: round(high52, 2), low52: round(low52, 2),
    high20: round(high20, 2), low20: round(low20, 2),
    returns: { d1: ret(1), d5: ret(5), d20: ret(20), d60: ret(60) },
    maArrangement,
    keyLevels: keyLevels(kline, price),
    series: { closes, volumes: vols, dates: kline.map((x) => x.date) },
    barCount: n
  };
  out.channelVerdict = channelVerdict(out);
  return out;
}

module.exports = { sma, ema, macd, rsi, kdj, boll, atr, computeIndicators, keyLevels, regressionChannel, donchian, bollState, channelVerdict, round };
