'use strict';
/**
 * 指标正确性闸门（确定性）
 * ========================
 * 回答一个 LLM 回答不了的问题：**代码算出来的数，真的是它声明的那条公式吗？**
 *
 * 两道确定性检查
 * --------------
 * A. 参考实现对拍（parity）
 *    用 lib/indicators/reference.js 的独立实现跑同一组输入，逐点比对生产实现。
 *    能发现"真正的逻辑错误"——这是 LLM 读代码做不到的，因为它不执行代码。
 *
 * B. 输出不变量（invariants）
 *    每个指标都有代数上必须成立的关系（如布林上轨 ≥ 中轨 ≥ 下轨、
 *    中轨 == MA20、KDJ 的 J == 3K−2D）。这些是**恒等式**，不是"看起来合理"。
 *    用 LLM 打分来判断这类关系是范畴错误 —— 它们可以精确验证，且零延迟。
 *
 * 与溯源契约的分工
 * ----------------
 *   溯源契约  → 数据**带没带**声明（结构层）
 *   本闸门    → 声明与实现**对不对得上**（语义层）
 * 两者互补，缺一不可。
 *
 * 用法：node scripts/verify-indicator-correctness.js
 *      node scripts/verify-indicator-correctness.js --code 002422
 */
const path = require('path');
const tech = require('../lib/tech.js');
const ref = require('../lib/indicators/reference.js');

const argv = process.argv.slice(2);
const CODE = (() => { const i = argv.indexOf('--code'); return i >= 0 ? argv[i + 1] : '600519'; })();

let pass = 0, fail = 0;
const failures = [];

/**
 * 已确认的口径差异登记表。
 * 口径不同 ≠ 算错了。两者必须分开处理，否则要么误报（把口径差异当 bug），
 * 要么漏报（放宽容差把真 bug 也放过去）。登记在案的差异不算失败，但必须被打印出来。
 */
const KNOWN_DIVERGENCES = [];

function t(name, ok, extra) {
  if (ok) { pass++; console.log('  ✅ ' + name); }
  else { fail++; failures.push(name); console.log('  ❌ ' + name + (extra ? '  → ' + extra : '')); }
}
const section = (s) => console.log('\n── ' + s + ' ' + '─'.repeat(Math.max(0, 68 - s.length)));

/* ---------------------------------------------------------------------------
 * 比对工具
 * ------------------------------------------------------------------------- */

/** 逐点比对两条序列。返回 {ok, maxDiff, at} */
function cmpSeries(a, b, tol, label) {
  if (!Array.isArray(a) || !Array.isArray(b)) return { ok: false, why: '非数组' };
  if (a.length !== b.length) return { ok: false, why: '长度不同 ' + a.length + ' vs ' + b.length };
  let maxDiff = 0, at = -1, compared = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i];
    const xNull = x == null || !Number.isFinite(x);
    const yNull = y == null || !Number.isFinite(y);
    if (xNull && yNull) continue;                 // 两边都空，跳过
    if (xNull !== yNull) return { ok: false, why: label + ' 第 ' + i + ' 点一方为空一方非空' };
    const d = Math.abs(x - y);
    compared++;
    if (d > maxDiff) { maxDiff = d; at = i; }
  }
  if (compared === 0) return { ok: false, why: '无可比对点（全部为空）' };
  return { ok: maxDiff <= tol, maxDiff, at, compared };
}

function cmpScalar(a, b, tol, label) {
  const an = a == null || !Number.isFinite(a);
  const bn = b == null || !Number.isFinite(b);
  if (an && bn) return { ok: true, maxDiff: 0, why: '双方均为空' };
  if (an !== bn) return { ok: false, why: label + ' 一方为空一方非空' };
  const d = Math.abs(a - b);
  return { ok: d <= tol, maxDiff: d };
}

/* ---------------------------------------------------------------------------
 * 主流程
 * ------------------------------------------------------------------------- */

(async () => {
  const engine = require('../lib/engine.js');
  let a;
  try { a = await engine.analyze(CODE); }
  catch (e) { console.error('分析失败：' + e.message); process.exit(2); }

  const k = a.chart.kline || [];
  const closes = k.map((x) => x.close);
  const highs = k.map((x) => x.high);
  const lows = k.map((x) => x.low);

  console.log('\n' + '='.repeat(74));
  console.log('  指标正确性闸门（确定性）');
  console.log('  A 参考实现对拍 · B 输出不变量');
  console.log('='.repeat(74));
  console.log('  标的 ' + CODE + ' ' + a.name + '   K线 ' + k.length + ' 根\n');

  /* ========================================================================
   * A. 参考实现对拍
   * ======================================================================*/
  section('A. 参考实现对拍（独立实现 vs 生产实现）');

  const TOL = 1e-6;   // 浮点容差：同一算法不同写法应当在此量级内一致

  /* A1 SMA */
  {
    const prod = tech.sma(closes, 20);
    const r = ref.sma(closes, 20);
    const c = cmpSeries(prod, r, TOL, 'SMA20');
    t('SMA20 与参考实现一致', c.ok, c.ok ? '' : c.why + (c.maxDiff != null ? ' 最大差 ' + c.maxDiff : ''));
  }

  /* A2 EMA */
  {
    const prod = tech.ema(closes, 12);
    const r = ref.ema(closes, 12);
    const c = cmpSeries(prod, r, 1e-9, 'EMA12');
    t('EMA12 与参考实现一致', c.ok, c.ok ? '' : c.why + (c.maxDiff != null ? ' 最大差 ' + c.maxDiff : ''));
  }

  /* A3 MACD */
  {
    const prod = tech.macd(closes);
    const r = ref.macd(closes);
    const cd = cmpSeries(prod.dif, r.dif, 1e-6, 'MACD.DIF');
    const ce = cmpSeries(prod.dea, r.dea, 1e-6, 'MACD.DEA');
    const ch = cmpSeries(prod.hist, r.hist, 1e-6, 'MACD.HIST');
    t('MACD.DIF 与参考实现一致', cd.ok, cd.ok ? '' : cd.why);
    t('MACD.DEA 与参考实现一致', ce.ok, ce.ok ? '' : ce.why);
    t('MACD.HIST 与参考实现一致', ch.ok, ch.ok ? '' : ch.why);
  }

  /* A4 RSI —— 注意：生产用等权平均，参考用 Wilder 平滑，两者**本就不应完全相等**。
   * 这里不是判失败，而是把差异量化出来 —— 差异大小本身就是"口径是否一致"的证据。 */
  {
    const prodRaw = tech.rsi(closes, 14);
    const prod = Array.isArray(prodRaw) ? prodRaw : [prodRaw];
    const r = ref.rsi(closes, 14);
    const c = cmpSeries(prod, r, 5.0, 'RSI14');
    const tail = (arr) => { for (let i = arr.length - 1; i >= 0; i--) if (Number.isFinite(arr[i])) return arr[i]; return null; };
    const pv = tail(prod), rv = tail(r);
    const diff = (pv != null && rv != null) ? Math.abs(pv - rv) : null;
    console.log('     RSI 口径差异：生产 ' + (pv == null ? '—' : pv.toFixed(2))
      + ' vs Wilder 参考 ' + (rv == null ? '—' : rv.toFixed(2))
      + (diff != null ? '（差 ' + diff.toFixed(2) + '）' : ''));
    t('RSI14 与 Wilder 参考差异在可接受范围（<5）', c.ok,
      c.ok ? '' : '最大差 ' + c.maxDiff + ' —— 口径可能不一致，需人工确认哪种是对的');
  }

  /* A5 BOLL */
  {
    const prod = tech.boll(closes, 20, 2);
    const r = ref.boll(closes, 20, 2);
    const cu = cmpSeries(prod.up, r.up, 1e-6, 'BOLL.up');
    const cm = cmpSeries(prod.mid, r.mid, 1e-6, 'BOLL.mid');
    const cd = cmpSeries(prod.dn, r.dn, 1e-6, 'BOLL.dn');
    t('BOLL 上轨与参考一致', cu.ok, cu.ok ? '' : cu.why);
    t('BOLL 中轨与参考一致', cm.ok, cm.ok ? '' : cm.why);
    t('BOLL 下轨与参考一致', cd.ok, cd.ok ? '' : cd.why);
  }

  /* A6 KDJ */
  {
    const prod = tech.kdj(highs, lows, closes, 9);
    const r = ref.kdj(highs, lows, closes, 9);
    const ck = cmpSeries(prod.k, r.k, 1e-6, 'KDJ.K');
    const cd = cmpSeries(prod.d, r.d, 1e-6, 'KDJ.D');
    const cj = cmpSeries(prod.j, r.j, 1e-6, 'KDJ.J');
    t('KDJ.K 与参考一致', ck.ok, ck.ok ? '' : ck.why);
    t('KDJ.D 与参考一致', cd.ok, cd.ok ? '' : cd.why);
    t('KDJ.J 与参考一致', cj.ok, cj.ok ? '' : cj.why);
  }

  /* A7 ATR —— 两种预热期口径都要查：
   *     ① 与生产的 'fill' 口径对拍 → 数值必须一致（这才是"算错没有"）
   *     ② 与严格的 'null' 口径对比 → 差异应被**显式登记**，而不是靠放宽容差蒙混
   * 这个差异是真实发现的：生产把前 n−1 个点也标为 ATR(14)，
   * 但它们实际是 ATR(1)~ATR(13)。属口径失真，非数值错误。 */
  {
    const prod = tech.atr(highs, lows, closes, 14);
    const rFill = ref.atr(highs, lows, closes, 14, { warmup: 'fill' });
    const cFill = cmpSeries(prod, rFill, 1e-6, 'ATR14(fill)');
    t('ATR14 与参考实现一致（同为 fill 口径）', cFill.ok,
      cFill.ok ? '' : cFill.why + (cFill.maxDiff != null ? ' 最大差 ' + cFill.maxDiff : ''));

    /* 口径差异量化：预热期有多少点、首点差多少 */
    const rNull = ref.atr(highs, lows, closes, 14, { warmup: 'null' });
    let warmupPoints = 0, firstDiff = null;
    for (let i = 0; i < prod.length; i++) {
      const pn = prod[i] == null, rn = rNull[i] == null;
      if (pn !== rn) { warmupPoints++; if (firstDiff == null) firstDiff = i; }
    }
    if (warmupPoints > 0) {
      console.log('     ⚠ 口径差异（已登记）：生产 fill 口径在预热期多产出 ' + warmupPoints
        + ' 个点（i=' + firstDiff + ' 起），这些点的实际窗口 < 14，却共用 "ATR(14)" 标签');
      console.log('       影响：图上预热段 ATR 偏低（窗口小→波动估计偏小）。'
        + '实际取 last(atr) 用于止损宽度时不受影响；但若有人读序列中段，会被误导');
      console.log('       处置建议：或改生产为 null 口径（图上晚 13 根出现），'
        + '或在溯源信封里把 window 标为 {nominal:14, warmup:"partial"}');
      KNOWN_DIVERGENCES.push({
        indicator: 'ATR',
        kind: 'WARMUP_CONVENTION',
        production: 'fill（预热期用部分窗口均值）',
        reference: 'null（预热期留空）',
        affectedPoints: warmupPoints,
        numericMatch: cFill.ok,
        verdict: '口径差异，非数值错误',
      });
    }
  }

  /* A8 唐奇安 */
  {
    const prod = tech.donchian(k, 20);
    const r = ref.donchian(highs, lows, 20);
    const cu = cmpScalar(prod.upper, r.upper, 1e-6, 'Donchian.upper');
    const cl = cmpScalar(prod.lower, r.lower, 1e-6, 'Donchian.lower');
    t('唐奇安上沿与参考一致', cu.ok, cu.ok ? '' : cu.why);
    t('唐奇安下沿与参考一致', cl.ok, cl.ok ? '' : cl.why);
  }

  /* ========================================================================
   * B. 输出不变量（代数恒等式，非"看起来合理"）
   * ======================================================================*/
  section('B. 输出不变量（代数恒等式）');

  const ind = a.ind;
  const finite = (x) => x == null || Number.isFinite(x);

  /* B1 布林三轨次序：up >= mid >= dn（恒等式，不允许例外） */
  {
    const b = a.chart.boll || {};
    const n = Math.min((b.up || []).length, (b.mid || []).length, (b.dn || []).length);
    let bad = 0, badAt = -1;
    for (let i = 0; i < n; i++) {
      if (![b.up[i], b.mid[i], b.dn[i]].every(Number.isFinite)) continue;
      if (!(b.up[i] >= b.mid[i] - 1e-9 && b.mid[i] >= b.dn[i] - 1e-9)) { bad++; if (badAt < 0) badAt = i; }
    }
    t('布林恒等式 up ≥ mid ≥ dn 全程成立', bad === 0, bad ? bad + ' 点违反，首个在 i=' + badAt : '');
  }

  /* B2 布林中轨 == MA20（定义式，必须精确成立） */
  {
    const b = a.chart.boll || {};
    const ma20 = ref.sma(closes, 20);
    const n = Math.min((b.mid || []).length, ma20.length);
    let maxDiff = 0;
    for (let i = 0; i < n; i++) {
      if (!Number.isFinite(b.mid[i]) || !Number.isFinite(ma20[i])) continue;
      maxDiff = Math.max(maxDiff, Math.abs(b.mid[i] - ma20[i]));
    }
    t('布林中轨 == MA20', maxDiff < 1e-6, '最大差 ' + maxDiff.toExponential(2));
  }

  /* B3 布林上下轨对称：up − mid == mid − dn（同一标准差） */
  {
    const b = a.chart.boll || {};
    const n = Math.min((b.up || []).length, (b.mid || []).length, (b.dn || []).length);
    let maxDiff = 0;
    for (let i = 0; i < n; i++) {
      if (![b.up[i], b.mid[i], b.dn[i]].every(Number.isFinite)) continue;
      maxDiff = Math.max(maxDiff, Math.abs((b.up[i] - b.mid[i]) - (b.mid[i] - b.dn[i])));
    }
    t('布林上下轨对称（同一标准差）', maxDiff < 1e-6, '最大差 ' + maxDiff.toExponential(2));
  }

  /* B4 KDJ 恒等式 J == 3K − 2D */
  {
    const { k: K, d: D, j: J } = ind.kdj || {};
    const maxDiff = Math.abs((J == null ? 0 : J) - (3 * (K || 0) - 2 * (D || 0)));
    t('KDJ 恒等式 J == 3K − 2D', maxDiff < 1e-6, '差 ' + maxDiff.toExponential(2));
  }

  /* B5 RSI 值域 [0,100] */
  {
    const r = ind.rsi;
    t('RSI ∈ [0,100]', r == null || (r >= 0 && r <= 100), '实际 ' + r);
  }

  /* B6 MA 值域：MA_n 必落在窗口内的 min/max 之间（均值的定义性质） */
  {
    const periods = [5, 10, 20, 60];
    let bad = null;
    for (const p of periods) {
      const v = ind.ma && ind.ma['ma' + p];
      if (v == null || !Number.isFinite(v)) continue;
      const win = closes.slice(-p);
      const lo = Math.min(...win), hi = Math.max(...win);
      if (v < lo - 1e-6 || v > hi + 1e-6) { bad = 'MA' + p + '=' + v + ' 越界 [' + lo + ',' + hi + ']'; break; }
    }
    t('MA 值落在窗口极值区间内（均值的定义性质）', bad === null, bad || '');
  }

  /* B7 序列长度一致性：主图各图层必须与 K 线等长或按末尾对齐 */
  {
    const kl = (a.chart.kline || []).length;
    const checks = [
      ['boll.up', (a.chart.boll || {}).up],
      ['boll.mid', (a.chart.boll || {}).mid],
      ['boll.dn', (a.chart.boll || {}).dn],
      ['rails.up', (a.chart.rails || {}).up],
      ['rails.dn', (a.chart.rails || {}).dn],
    ];
    const bad = checks.filter(([, arr]) => Array.isArray(arr) && arr.length > kl)
      .map(([nm, arr]) => nm + '(' + arr.length + '>' + kl + ')');
    t('图层序列长度不超过 K 线长度', bad.length === 0, bad.join(' '));
  }

  /* B8 全序列无 NaN / Infinity（NaN 污染会让整图空白，且不报错） */
  {
    const series = [
      ['boll.up', (a.chart.boll || {}).up],
      ['boll.dn', (a.chart.boll || {}).dn],
      ['rails.up', (a.chart.rails || {}).up],
      ['rails.dn', (a.chart.rails || {}).dn],
      ['macd.dif', (a.chart.macd || {}).dif],
      ['macd.dea', (a.chart.macd || {}).dea],
    ];
    const bad = [];
    series.forEach(([nm, arr]) => {
      if (!Array.isArray(arr)) return;
      const n = arr.filter((v) => v != null && !Number.isFinite(v)).length;
      if (n) bad.push(nm + '(' + n + ')');
    });
    t('全序列无 NaN / Infinity', bad.length === 0, bad.join(' '));
  }

  /* B9 回归导轨：三轨次序 + 残差带对称 */
  {
    const r = a.chart.rails || {};
    const n = Math.min((r.up || []).length, (r.mid || []).length, (r.dn || []).length);
    let orderBad = 0, symMax = 0;
    for (let i = 0; i < n; i++) {
      if (![r.up[i], r.mid[i], r.dn[i]].every(Number.isFinite)) continue;
      if (!(r.up[i] >= r.mid[i] - 1e-6 && r.mid[i] >= r.dn[i] - 1e-6)) orderBad++;
      symMax = Math.max(symMax, Math.abs((r.up[i] - r.mid[i]) - (r.mid[i] - r.dn[i])));
    }
    t('导轨三轨次序 up ≥ mid ≥ dn', orderBad === 0, orderBad + ' 点违反');
    t('导轨残差带对称（同一 σ）', symMax < 1e-6, '最大差 ' + symMax.toExponential(2));
  }

  /* B10 唐奇安：上沿 ≥ 下沿，且当前价未被包含（不含当日的口径） */
  {
    const d = ind.donchian || {};
    t('唐奇安上沿 ≥ 下沿', d.upper >= d.lower, d.upper + ' vs ' + d.lower);
    const price = a.quote && a.quote.price;
    if (price != null) {
      const inRange = price >= d.lower && price <= d.upper;
      console.log('     当前价 ' + price + ' 位于区间 [' + d.lower + ', ' + d.upper + '] '
        + (inRange ? '内' : '外') + '（口径：区间不含当日，价在区间外属正常）');
    }
  }

  /* ========================================================================
   * 汇总
   * ======================================================================*/
  console.log('\n' + '='.repeat(74));
  console.log('  通过 ' + pass + '   失败 ' + fail);
  if (KNOWN_DIVERGENCES.length) {
    console.log('\n  已登记的口径差异（不算失败，但需人工确认取舍）：');
    KNOWN_DIVERGENCES.forEach((d) => {
      console.log('    · ' + d.indicator + ' [' + d.kind + '] '
        + '生产=' + d.production + ' / 参考=' + d.reference
        + '，影响 ' + d.affectedPoints + ' 点，数值对拍 ' + (d.numericMatch ? '一致' : '不一致'));
    });
  }
  if (failures.length) {
    console.log('\n  失败项：');
    failures.forEach((f) => console.log('    · ' + f));
  }
  console.log('='.repeat(74) + '\n');
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error('异常: ' + e.stack); process.exit(2); });
