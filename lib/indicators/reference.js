'use strict';
/**
 * lib/indicators/reference.js — 参考实现（对拍基准）
 * ==================================================
 *
 * 用途
 * ----
 * 提供每个指标的**独立实现**，用于和生产实现做数值对拍。
 *
 * 为什么参考实现是"验证代码是否真的算对了"的唯一确定性手段
 * --------------------------------------------------------
 * 「代码是否实现了 formula 声明的算法」这个问题，有三条路：
 *
 *   ① 让 LLM 读代码做语义判断
 *      便宜、快，但**它不执行代码**，只能从表面模式猜。官方文档自己也说
 *      「模型仍可能在合法的选项里选错」。用它做**拦截**等于把闸门建在猜测上。
 *
 *   ② 把 formula 变成可执行表达式（DSL）
 *      能 100% 证明，但要维护一套 DSL，成本高、可读性差。
 *
 *   ③ 写一份独立的参考实现，跑同一组输入，比对输出
 *      **确定性、零幻觉、能发现真正的逻辑错误**，而且顺带验证了 window ——
 *      因为参考实现本身就是按 window 参数算的。
 *
 * 本文件走第 ③ 条路。参考实现**故意写得笨**：
 *   - 用最直白的循环，不用花哨的高阶函数
 *   - 不做性能优化（生产实现可以优化，参考实现只求正确）
 *   - 算法结构与生产实现**刻意不同**，避免"同一个错误写两遍"而互相印证
 *
 * 这一点很关键：如果参考实现和生产实现用了同一种写法，那它们会一起错。
 * 所以这里用**累加和**而生产用 slice+reduce，用**递归式**而生产用迭代式。
 */

/* ---------------------------------------------------------------------------
 * 基础
 * ------------------------------------------------------------------------- */

/** 简单移动平均 —— 用滚动累加和，与生产的 slice+reduce 结构不同 */
function sma(values, n) {
  const out = new Array(values.length).fill(null);
  if (n <= 0) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= n) sum -= values[i - n];
    if (i >= n - 1) out[i] = sum / n;
  }
  return out;
}

/** 指数移动平均 —— 用递归式定义（EMA_t = α·x_t + (1-α)·EMA_{t-1}），α=2/(n+1) */
function ema(values, n) {
  const out = new Array(values.length).fill(null);
  if (n <= 0 || values.length === 0) return out;
  const alpha = 2 / (n + 1);
  let prev = values[0];
  out[0] = prev;
  for (let i = 1; i < values.length; i++) {
    prev = alpha * values[i] + (1 - alpha) * prev;
    out[i] = prev;
  }
  return out;
}

/* ---------------------------------------------------------------------------
 * 指标
 * ------------------------------------------------------------------------- */

/** MACD(12,26,9) —— DIF = EMA12 − EMA26，DEA = EMA9(DIF)，柱 = (DIF−DEA)×2 */
function macd(closes, fast = 12, slow = 26, signal = 9) {
  const e1 = ema(closes, fast);
  const e2 = ema(closes, slow);
  const dif = closes.map((_, i) => (e1[i] == null || e2[i] == null ? null : e1[i] - e2[i]));
  const difClean = dif.map((v) => (v == null ? 0 : v));
  const dea = ema(difClean, signal);
  const hist = dif.map((v, i) => (v == null || dea[i] == null ? null : (v - dea[i]) * 2));
  return { dif, dea, hist };
}

/** RSI(n) —— 用 Wilder 平滑（递归），与生产的等权平均结构不同 */
function rsi(closes, n = 14) {
  const out = new Array(closes.length).fill(null);
  if (closes.length < n + 1) return out;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= n; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) avgGain += d; else avgLoss -= d;
  }
  avgGain /= n; avgLoss /= n;
  out[n] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = n + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const g = d > 0 ? d : 0;
    const l = d < 0 ? -d : 0;
    avgGain = (avgGain * (n - 1) + g) / n;
    avgLoss = (avgLoss * (n - 1) + l) / n;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

/** KDJ(9,3,3) —— RSV 用最高/最低，K/D 用 2/3·前值 + 1/3·新值 */
function kdj(highs, lows, closes, n = 9) {
  const K = new Array(closes.length).fill(null);
  const D = new Array(closes.length).fill(null);
  const J = new Array(closes.length).fill(null);
  let k = 50, d = 50;
  for (let i = n - 1; i < closes.length; i++) {
    let hh = -Infinity, ll = Infinity;
    for (let j = i - n + 1; j <= i; j++) {
      if (highs[j] > hh) hh = highs[j];
      if (lows[j] < ll) ll = lows[j];
    }
    const rsv = hh === ll ? 50 : ((closes[i] - ll) / (hh - ll)) * 100;
    k = (2 / 3) * k + (1 / 3) * rsv;
    d = (2 / 3) * d + (1 / 3) * k;
    K[i] = k; D[i] = d; J[i] = 3 * k - 2 * d;
  }
  return { k: K, d: D, j: J };
}

/** 布林(20,2) —— 中轨=MA20，上下轨=中轨±2×总体标准差（除以 n，不是 n-1） */
function boll(closes, n = 20, k = 2) {
  const mid = sma(closes, n);
  const up = new Array(closes.length).fill(null);
  const dn = new Array(closes.length).fill(null);
  for (let i = n - 1; i < closes.length; i++) {
    let s = 0;
    for (let j = i - n + 1; j <= i; j++) s += (closes[j] - mid[i]) ** 2;
    const sd = Math.sqrt(s / n);
    up[i] = mid[i] + k * sd;
    dn[i] = mid[i] - k * sd;
  }
  return { up, mid, dn };
}

/**
 * ATR(14) —— 真实波幅 = max(H−L, |H−C_prev|, |L−C_prev|)，Wilder 平滑
 *
 * 预热期口径（opts.warmup）：
 *   'null'（默认）—— 窗口不足时留空。第 n 点才有第一个值，语义严格：
 *                    只有满窗口的结果才配叫 ATR(n)。
 *   'fill'        —— 窗口不足时用"截至当前的等权均值"填充。
 *                    生产实现（lib/tech.js）用的是这一种，好处是图上从第 1 根就有线。
 *
 * ⚠️ 已确认的口径差异：生产实现用 'fill'，因此其前 n−1 个点的实际窗口是
 *    1..n−1，却与满窗口值共用同一个 "ATR(14)" 标签。本函数支持两种口径，
 *    是为了在对拍时能区分「数值算错」与「口径不同」——
 *    这两件事的严重程度完全不同，不能混为一谈。
 */
function atr(highs, lows, closes, n = 14, opts = {}) {
  const warmup = opts.warmup || 'null';
  const out = new Array(closes.length).fill(null);
  if (closes.length < n + 1) return out;
  const tr = [null];
  for (let i = 1; i < closes.length; i++) {
    tr.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    ));
  }
  let prev = null;
  for (let i = 1; i < tr.length; i++) {
    if (i < n) {
      if (warmup !== 'fill') continue;             // 留空：预热期不产出
      prev = tr.slice(1, i + 1).reduce((s, x) => s + x, 0) / i;
    } else {
      prev = (prev * (n - 1) + tr[i]) / n;
    }
    out[i] = prev;
  }
  return out;
}

/** 唐奇安(20) —— 近 n 日最高/最低（**不含当日**，与生产口径一致） */
function donchian(highs, lows, n = 20) {
  let hh = -Infinity, ll = Infinity;
  const start = Math.max(0, highs.length - 1 - n);
  for (let i = start; i < highs.length - 1; i++) {
    if (highs[i] > hh) hh = highs[i];
    if (lows[i] < ll) ll = lows[i];
  }
  return { upper: hh, lower: ll, mid: (hh + ll) / 2 };
}

/** 最小二乘线性回归通道 —— 用正规方程解析解，与生产的增量拟合结构不同 */
function regressionChannel(closes, n) {
  const y = closes.slice(-n);
  const N = y.length;
  if (N < 3) return null;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < N; i++) {
    sx += i; sy += y[i]; sxx += i * i; sxy += i * y[i];
  }
  const denom = N * sxx - sx * sx;
  if (denom === 0) return null;
  const slope = (N * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / N;

  let ss = 0;
  for (let i = 0; i < N; i++) {
    const pred = intercept + slope * i;
    ss += (y[i] - pred) ** 2;
  }
  const residSd = Math.sqrt(ss / N);

  const up = [], mid = [], dn = [];
  for (let i = 0; i < N; i++) {
    const m = intercept + slope * i;
    mid.push(m);
    up.push(m + 2 * residSd);
    dn.push(m - 2 * residSd);
  }
  return { up, mid, dn, slope, intercept, residSd, n: N };
}

module.exports = { sma, ema, macd, rsi, kdj, boll, atr, donchian, regressionChannel };
