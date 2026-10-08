'use strict';
/**
 * 外部锚定验证（Oracle Anchoring）
 * ==================================
 * 回答上一轮留下的问题：**24 个指标里，有几个能找到外部权威数值来锚定？**
 *
 * 为什么必须做
 * ------------
 * 「我的生产实现」和「我的参考实现」对拍，只能证明**内部自洽**。
 * 如果我对某个概念（如 EMA 的种子、BOLL 的标准差口径）一开始就理解错了，
 * 两份代码会**一起错**，闸门照样全绿。
 *
 * 唯一打破循环的办法：引入**作者与我完全无关**的第三方实现。
 * 本脚本用 npm 上的 `technicalindicators`（124 个指标、独立实现）做外部锚。
 *
 * 三方对比：生产 tech.js  vs  我的参考实现  vs  第三方库
 *
 * 重要认知：**外部权威不是一个值，是一组约定**
 * ------------------------------------------------
 * 不同库对同一指标给出不同数值，不是"谁错了"，而是它们选了**不同的约定**。
 * 例如 EMA 的种子：有人用首个值，有人用前 n 个的 SMA。
 * 本脚本的核心产出不是"通过/失败"，而是**把约定差异逐条列出来**，
 * 让人明确知道：哪些指标全球统一（可硬对拍），哪些存在合理分歧（需声明口径）。
 *
 * 用法：node scripts/verify-oracle-anchoring.js [--code 600519]
 */
const path = require('path');

const argv = process.argv.slice(2);
const CODE = (() => { const i = argv.indexOf('--code'); return i >= 0 ? argv[i + 1] : '600519'; })();

const tech = require('../lib/tech.js');
const ref = require('../lib/indicators/reference.js');

let ti = null;
try { ti = require('technicalindicators'); }
catch { console.log('⚠ technicalindicators 未安装，外部锚不可用 —— 本脚本将只做双方对拍'); }

/* ---------------------------------------------------------------------------
 * 工具
 * ------------------------------------------------------------------------- */

/** 取序列最后一个有限值 */
function tail(arr) {
  if (!Array.isArray(arr)) return null;
  for (let i = arr.length - 1; i >= 0; i--) if (Number.isFinite(arr[i])) return arr[i];
  return null;
}

/** 把第三方库的短序列（长度 n−p+1）按末尾对齐到完整长度 */
function alignTail(shortArr, fullLen) {
  const out = new Array(fullLen).fill(null);
  const off = fullLen - shortArr.length;
  for (let i = 0; i < shortArr.length; i++) out[off + i] = shortArr[i];
  return out;
}

const rows = [];

/**
 * 记录一条对比结论。
 * @param {string} indicator 指标名
 * @param {string} tier      锚定等级（判定后填）
 * @param {string} verdict   结论
 * @param {string} note      约定差异说明
 */
function rec(indicator, tier, verdict, note) {
  rows.push({ indicator, tier, verdict, note });
}

function fmt(x) { return x == null || !Number.isFinite(x) ? '—' : x.toFixed(4); }

/* ---------------------------------------------------------------------------
 * 主流程
 * ------------------------------------------------------------------------- */

(async () => {
  const engine = require('../lib/engine.js');
  const a = await engine.analyze(CODE);
  const k = a.chart.kline || [];
  const closes = k.map((x) => x.close);
  const highs = k.map((x) => x.high);
  const lows = k.map((x) => x.low);
  const N = closes.length;

  console.log('\n' + '='.repeat(78));
  console.log('  外部锚定验证 —— 生产实现 vs 我的参考实现 vs 第三方库');
  console.log('='.repeat(78));
  console.log('  标的 ' + CODE + ' ' + a.name + '   K线 ' + N + ' 根');
  console.log('  外部锚：' + (ti ? 'technicalindicators（npm，独立实现，124 个指标）' : '不可用'));
  console.log('');

  if (!ti) {
    console.log('  无外部锚时只能做双方对拍 —— 那只证明内部自洽，证明不了正确。');
    console.log('');
  }

  /* ======================= 1. SMA — 无约定歧义 ======================= */
  {
    const prod = tech.sma(closes, 20);
    const mine = ref.sma(closes, 20);
    let ext = null;
    if (ti) ext = alignTail(ti.SMA.calculate({ period: 20, values: closes }), N);

    const pv = tail(prod), mv = tail(mine), ev = ext ? tail(ext) : null;
    const dpm = Math.abs(pv - mv);
    const dpe = ev == null ? null : Math.abs(pv - ev);

    console.log('── SMA(20) ───────────────────────────────────────────────────────────');
    console.log('   生产 ' + fmt(pv) + '   参考 ' + fmt(mv) + '   第三方 ' + fmt(ev));
    console.log('   差：生产↔参考 ' + dpm.toExponential(2) + (dpe != null ? '   生产↔第三方 ' + dpe.toExponential(2) : ''));

    if (dpe != null && dpe < 1e-6) {
      console.log('   ✅ 三方一致 —— 可硬对拍（Tier 1）');
      rec('SMA(20)', 'Tier 1', '三方一致', '简单均值无约定歧义');
    } else if (dpe != null) {
      console.log('   ⚠ 与第三方不一致，差 ' + dpe.toExponential(2));
      rec('SMA(20)', 'Tier ?', '存在差异', '需排查');
    }
    console.log('');
  }

  /* ======================= 2. EMA — 种子约定 ======================= */
  {
    const prod = tech.ema(closes, 12);
    const mine = ref.ema(closes, 12);
    let ext = null;
    if (ti) ext = alignTail(ti.EMA.calculate({ period: 12, values: closes }), N);

    const pv = tail(prod), mv = tail(mine), ev = ext ? tail(ext) : null;
    console.log('── EMA(12) ───────────────────────────────────────────────────────────');
    console.log('   生产 ' + fmt(pv) + '   参考 ' + fmt(mv) + '   第三方 ' + fmt(ev));
    console.log('   差：生产↔参考 ' + Math.abs(pv - mv).toExponential(2)
      + (ev != null ? '   生产↔第三方 ' + Math.abs(pv - ev).toExponential(2) : ''));

    if (ev != null) {
      const d = Math.abs(pv - ev);
      const rel = d / Math.abs(ev) * 100;
      console.log('   相对偏差 ' + rel.toFixed(4) + '%');
      /* 种子差异会随序列变长而指数衰减：alpha=2/13，N=120 时残差约 (1-alpha)^119 ≈ 1e-9
         所以 120 根之后，种子选择的影响已经可以忽略 */
      if (rel < 0.001) {
        console.log('   ✅ 收敛一致 —— 种子约定差异在 ' + N + ' 根后已衰减到可忽略');
        rec('EMA(12)', 'Tier 1', '收敛一致', '种子约定不同，但 120 根后残差 <0.001%');
      } else {
        console.log('   ⚠ 存在可见差异 —— 种子约定影响未衰减');
        rec('EMA(12)', 'Tier 1.5', '种子约定差异', '相对偏差 ' + rel.toFixed(4) + '%');
      }
    }
    console.log('');
  }

  /* ======================= 3. RSI — Wilder 平滑 ======================= */
  {
    const prodRaw = tech.rsi(closes, 14);
    const prod = Array.isArray(prodRaw) ? prodRaw : [prodRaw];
    const mine = ref.rsi(closes, 14);
    let ext = null;
    if (ti) ext = alignTail(ti.RSI.calculate({ period: 14, values: closes }), N);

    const pv = tail(prod), mv = tail(mine), ev = ext ? tail(ext) : null;
    console.log('── RSI(14) ───────────────────────────────────────────────────────────');
    console.log('   生产 ' + fmt(pv) + '   参考 ' + fmt(mv) + '   第三方 ' + fmt(ev));
    console.log('   差：生产↔参考 ' + Math.abs(pv - mv).toExponential(2)
      + (ev != null ? '   生产↔第三方 ' + Math.abs(pv - ev).toExponential(2) : ''));

    if (ev != null) {
      const d = Math.abs(pv - ev);
      if (d < 0.01) {
        console.log('   ✅ 三方一致 —— 可硬对拍（Tier 1）');
        rec('RSI(14)', 'Tier 1', '三方一致', 'Wilder 平滑为业界统一约定');
      } else if (d < 1) {
        console.log('   ⚠ 接近但不完全一致，差 ' + d.toFixed(4) + ' —— 平滑口径可能有细微差别');
        rec('RSI(14)', 'Tier 1.5', '接近', '差 ' + d.toFixed(4));
      } else {
        console.log('   ❌ 显著不一致，差 ' + d.toFixed(4) + ' —— 平滑算法口径不同（等权 vs Wilder）');
        rec('RSI(14)', 'Tier 1.5', '平滑口径不同', '差 ' + d.toFixed(4) + '，需声明采用哪种');
      }
    }
    console.log('');
  }

  /* ======================= 4. MACD — 依赖 EMA 种子 ======================= */
  {
    const prod = tech.macd(closes);
    let ext = null;
    if (ti) {
      const r = ti.MACD.calculate({
        values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9,
        SimpleMAOscillator: false, SimpleMASignal: false,
      });
      ext = {
        dif: alignTail(r.map((x) => x.MACD), N),
        dea: alignTail(r.map((x) => x.signal), N),
        hist: alignTail(r.map((x) => x.histogram), N),
      };
    }
    const pv = tail(prod.dif), ev = ext ? tail(ext.dif) : null;
    console.log('── MACD(12,26,9) ─────────────────────────────────────────────────────');
    console.log('   DIF  生产 ' + fmt(pv) + '   第三方 ' + fmt(ev));
    if (ev != null) {
      const d = Math.abs(pv - ev);
      const rel = d / Math.abs(ev) * 100;
      console.log('   相对偏差 ' + rel.toFixed(4) + '%');
      if (rel < 0.01) {
        console.log('   ✅ 收敛一致（EMA 种子差异已衰减）—— Tier 1');
        rec('MACD', 'Tier 1', '收敛一致', 'DIF 相对偏差 ' + rel.toFixed(4) + '%');
      } else {
        console.log('   ⚠ 存在差异 —— 源自 EMA 种子约定');
        rec('MACD', 'Tier 1.5', '种子约定差异', '相对偏差 ' + rel.toFixed(4) + '%');
      }
    }
    console.log('');
  }

  /* ======================= 5. BOLL — 标准差口径 ======================= */
  {
    const prod = tech.boll(closes, 20, 2);
    let ext = null;
    if (ti) {
      const r = ti.BollingerBands.calculate({ period: 20, stdDev: 2, values: closes });
      ext = { up: alignTail(r.map((x) => x.upper), N), dn: alignTail(r.map((x) => x.lower), N) };
    }
    const pv = tail(prod.up), ev = ext ? tail(ext.up) : null;
    console.log('── BOLL(20,2) 上轨 ──────────────────────────────────────────────────');
    console.log('   生产 ' + fmt(pv) + '   第三方 ' + fmt(ev));
    if (ev != null) {
      const d = Math.abs(pv - ev);
      console.log('   绝对差 ' + d.toExponential(2));
      if (d < 1e-6) {
        console.log('   ✅ 一致 —— 标准差口径相同（总体标准差，除以 n）');
        rec('BOLL(20,2)', 'Tier 1', '口径一致', '均为总体标准差 σ=√(Σ(x−μ)²/n)');
      } else {
        console.log('   ⚠ 不一致 —— 标准差口径不同（总体 /n vs 样本 /(n−1)）');
        rec('BOLL(20,2)', 'Tier 1.5', '标准差口径不同', '差 ' + d.toExponential(2));
      }
    }
    console.log('');
  }

  /* ======================= 6. ATR — 平滑口径 ======================= */
  {
    const prod = tech.atr(highs, lows, closes, 14);
    let ext = null;
    if (ti) ext = alignTail(ti.ATR.calculate({ period: 14, high: highs, low: lows, close: closes }), N);

    const pv = tail(prod), ev = ext ? tail(ext) : null;
    console.log('── ATR(14) ───────────────────────────────────────────────────────────');
    console.log('   生产 ' + fmt(pv) + '   第三方 ' + fmt(ev));
    if (ev != null) {
      const d = Math.abs(pv - ev);
      const rel = d / Math.abs(ev) * 100;
      console.log('   相对偏差 ' + rel.toFixed(4) + '%');
      if (rel < 1) {
        console.log('   ✅ 一致 —— 均为 Wilder 平滑');
        rec('ATR(14)', 'Tier 1', '一致', 'Wilder 平滑，相对偏差 ' + rel.toFixed(4) + '%');
      } else {
        console.log('   ⚠ 差异 ' + rel.toFixed(2) + '% —— 平滑或预热口径不同');
        rec('ATR(14)', 'Tier 1.5', '平滑/预热口径差异', '相对偏差 ' + rel.toFixed(2) + '%');
      }
    }
    console.log('');
  }

  /* ======================= 7. KDJ — 外部锚不存在 ======================= */
  {
    console.log('── KDJ(9,3,3) ────────────────────────────────────────────────────────');
    const hasKdj = ti && typeof ti.KDJ !== 'undefined';
    console.log('   第三方库是否提供 KDJ：' + (hasKdj ? '是' : '否'));
    console.log('   第三方提供 Stochastic：' + (ti && ti.Stochastic ? '是' : '否'));
    console.log('   ⚠ KDJ 与 Stochastic 不等价：');
    console.log('       · Stochastic 默认 fastk_period=5，KDJ 用 9');
    console.log('       · KDJ 的 K = 2/3·prevK + 1/3·RSV（等价 EMA(5)），TA-Lib 的 slowk_matype 是另一套平滑');
    console.log('       · J = 3K − 2D 是中文市场约定，TA-Lib / technicalindicators 均无 J');
    console.log('   → KDJ 属 **Tier 2**：有行业共识但无唯一外部权威，只能做属性测试');
    rec('KDJ(9,3,3)', 'Tier 2', '无外部权威', 'Stochastic 不等价；J 为中文市场专有');
    console.log('');
  }

  /* ======================= 8. 唐奇安 — 外部锚不存在 ======================= */
  {
    console.log('── Donchian(20) ──────────────────────────────────────────────────────');
    const hasDon = ti && (typeof ti.Donchian !== 'undefined');
    console.log('   第三方库是否提供 Donchian：' + (hasDon ? '是' : '否'));
    console.log('   ⚠ 但可用 Highest/Lowest 组合构造，属"可推导的外部锚"');
    if (ti && ti.Highest && ti.Lowest) {
      /* 口径：生产用"不含当日"的 n 日区间；第三方 Highest 含当日，故取 n+1 再错开一位 */
      const prod = tech.donchian(k, 20);
      const hiAll = ti.Highest.calculate({ period: 21, values: highs });
      const loAll = ti.Lowest.calculate({ period: 21, values: lows });
      /* 构造"截至前一日的 20 日极值" */
      const extUpper = hiAll[hiAll.length - 2];
      const extLower = loAll[loAll.length - 2];
      console.log('   生产 上沿 ' + fmt(prod.upper) + ' 下沿 ' + fmt(prod.lower));
      console.log('   第三方(含当日口径换算) 上沿 ' + fmt(extUpper) + ' 下沿 ' + fmt(extLower));
      const du = Math.abs(prod.upper - extUpper);
      const dl = Math.abs(prod.lower - extLower);
      if (du < 1e-6 && dl < 1e-6) {
        console.log('   ✅ 一致 —— 可用 Highest/Lowest 做外部锚（Tier 1）');
        rec('Donchian(20)', 'Tier 1', '可推导一致', '用 Highest/Lowest 构造，口径已对齐');
      } else {
        console.log('   ⚠ 差异 上沿 ' + du.toExponential(2) + ' 下沿 ' + dl.toExponential(2)
          + ' —— 可能是"是否含当日"的口径差异');
        rec('Donchian(20)', 'Tier 1.5', '口径需对齐', '上沿差 ' + du.toExponential(2));
      }
    }
    console.log('');
  }

  /* ======================= 汇总：分层信任表 ======================= */
  console.log('='.repeat(78));
  console.log('  外部锚定分层结论');
  console.log('='.repeat(78));
  console.log('  ' + '指标'.padEnd(18) + '层级'.padEnd(12) + '结论');
  console.log('  ' + '-'.repeat(74));
  rows.forEach((r) => {
    console.log('  ' + r.indicator.padEnd(18) + r.tier.padEnd(12) + r.verdict);
  });

  const t1 = rows.filter((r) => r.tier === 'Tier 1').length;
  const t15 = rows.filter((r) => r.tier === 'Tier 1.5').length;
  const t2 = rows.filter((r) => r.tier === 'Tier 2').length;

  console.log('');
  console.log('  Tier 1   可硬对拍（三方一致）      ' + t1 + ' 项');
  console.log('  Tier 1.5 有约定差异，需声明口径    ' + t15 + ' 项');
  console.log('  Tier 2   无外部权威，只能属性测试  ' + t2 + ' 项');
  console.log('');
  console.log('  ── 认知边界声明 ──');
  console.log('  本闸门能证明：实现与**某个被广泛接受的约定**一致。');
  console.log('  本闸门不能证明：该约定本身在金融市场中有效。');
  console.log('  对 Tier 1.5，必须在使用方显式声明采用了哪种口径；');
  console.log('  对 Tier 2，不存在"正确值"，只有"逻辑自洽"。');
  console.log('='.repeat(78) + '\n');
})().catch((e) => { console.error('异常: ' + e.stack); process.exit(2); });
