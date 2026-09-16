'use strict';
/**
 * 画像合成（portrait）
 * ================================================================
 * 两件事：
 *
 * 1. deriveLevels(ind) —— 从实时指标推导一套完整的交易价位（建仓区间 / 止损 / 硬止损 /
 *    两级目标位 / 支撑阻力）。这是引擎与画像共用的唯一推导来源，避免同一套
 *    ATR + 关键位逻辑在 buildPlan 和画像里各写一遍。
 *
 * 2. synthesizeProfile(ctx) —— 为**任意查询标的**生成一份"自动画像"，
 *    使没有导入投研报告的股票也有完整的画像卡片与监控清单。
 *
 * ⚠️ 诚信边界（重要，不可弱化）
 *    自动画像不是投研报告。它只基于实时行情与 K 线推导，不含基本面判断、
 *    不含机构观点、不含公司调研结论。因此：
 *      · profileQuality 固定为 'auto'，UI 必须显著标注来源；
 *      · 不伪造 valuation.fairPe 这类"合理估值区间"（没有研报依据就不该有）；
 *      · 不设置 cost（没有持仓就不该有浮盈浮亏）；
 *      · 不冒充专属清单口径 —— 它的清单就是通用技术清单。
 *
 * 约束：本文件会进浏览器产物，禁止 require Node 模块、禁止读进程环境。
 */
const monitors = require('./monitors');

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const r2 = (x) => (Number.isFinite(x) ? +x.toFixed(2) : null);
const n2 = monitors.n2;

const AUTO_QUALITY = 'auto';
const AUTO_SOURCE = '由实时行情自动生成（非投研报告）';

/* ================================================================== */
/* 1. 价位推导（引擎与画像共用）                                        */
/* ================================================================== */
/**
 * 从 ATR 与关键位推导交易价位。
 * 与历史上 buildPlan 的兜底口径保持一致：建仓区间取现价下方 1.5~0.5 ATR，
 * 止损 2.5 ATR，硬止损 3.5 ATR，目标位优先取真实阻力，其次按 ATR 外推。
 */
function deriveLevels(ind) {
  const P = ind.price;
  const atr = ind.atr || P * 0.02;

  /* --- 支撑 / 阻力：优先用 K 线关键位，不足 2 个时用均线补齐 --- */
  const supports = (ind.keyLevels || []).filter((k) => k.side === 'support')
    .sort((a, b) => b.price - a.price).slice(0, 5);
  const resistances = (ind.keyLevels || []).filter((k) => k.side === 'resistance')
    .sort((a, b) => a.price - b.price).slice(0, 5);

  const maRef = [
    { name: 'MA5', v: ind.ma?.ma5 }, { name: 'MA10', v: ind.ma?.ma10 }, { name: 'MA20', v: ind.ma?.ma20 },
    { name: 'MA30', v: ind.ma?.ma30 }, { name: 'MA60', v: ind.ma?.ma60 }, { name: 'MA120', v: ind.ma?.ma120 },
    { name: 'MA250', v: ind.ma?.ma250 }
  ].filter((x) => x.v != null);

  if (supports.length < 2) {
    maRef.filter((x) => x.v < P).sort((a, b) => b.v - a.v).slice(0, 3).forEach((x) =>
      supports.push({ price: x.v, count: 0, side: 'support', dist: +(((x.v - P) / P) * 100).toFixed(2), label: x.name }));
  }
  if (resistances.length < 2) {
    maRef.filter((x) => x.v > P).sort((a, b) => a.v - b.v).slice(0, 3).forEach((x) =>
      resistances.push({ price: x.v, count: 0, side: 'resistance', dist: +(((x.v - P) / P) * 100).toFixed(2), label: x.name }));
  }
  resistances.sort((a, b) => a.price - b.price);
  supports.sort((a, b) => b.price - a.price);

  /* --- 价位 --- */
  const entryLo = r2(P - atr * 1.5);
  const entryHi = r2(P - atr * 0.5);
  const stopLoss = r2(P - atr * 2.5);
  const hardStop = r2(P - atr * 3.5);

  // 目标位与现价保持 ≥1.2×ATR 距离，避免"贴脸"目标导致盈亏比失真
  const minTgtDist = atr * 1.2;
  const farRes = resistances.filter((r) => r.price >= P + minTgtDist);
  const target1 = farRes[0]?.price ?? r2(P + atr * 4);
  let target2 = farRes.filter((r) => r.price > target1)[0]?.price ?? r2(P + atr * 7);
  if (target2 == null || target2 <= target1) target2 = r2(target1 + atr * 3);

  return {
    entry: [entryLo, entryHi],
    stopLoss, hardStop, target1, target2,
    positionLimit: 0.1,
    atr: r2(atr),
    supports, resistances
  };
}

/* ================================================================== */
/* 2. 自动画像合成                                                     */
/* ================================================================== */
const MARKET_LABEL = { sh: '沪市', sz: '深市' };

/** 由当前技术状态生成画像标签 */
function buildTags(ind) {
  const tags = ['自动画像'];
  const code = ind && ind.price;
  if (code != null) {
    const a = ind.maArrangement;
    if (a === 'bull') tags.push('多头排列');
    else if (a === 'bear') tags.push('空头排列');
    else tags.push('均线纠缠');
  }
  const r = ind?.rsi;
  if (r != null) {
    if (r >= 80) tags.push('超买');
    else if (r <= 30) tags.push('超卖');
    else if (r >= 50) tags.push('偏强');
    else tags.push('偏弱');
  }
  const dir = ind?.rails?.dir;
  if (ind?.rails?.reliable && dir) tags.push(dir === 'up' ? '上升导轨' : dir === 'down' ? '下降导轨' : '箱体震荡');
  const cell = MARKET_LABEL[ind?.market] || null;
  if (cell) tags.push(cell);
  return tags.slice(0, 5);
}

/** 由当前技术状态生成投资逻辑摘要（不编造基本面） */
function buildThesis(name, code, ind, quote) {
  const P = n2(ind.price);
  const ma = ind.ma || {};
  const m = ind.macd || {};
  const arr = ind.maArrangement === 'bull' ? '均线多头排列'
    : ind.maArrangement === 'bear' ? '均线空头排列' : '均线纠缠、方向未选择';
  const parts = [
    `${name}（${code}）现价 ${P} 元，${arr}；MA20 ${n2(ma.ma20)}、MA60 ${n2(ma.ma60)}。`,
    `MACD DIF ${n2(m.dif)} / DEA ${n2(m.dea)}，RSI(14) ${n2(ind.rsi)}，`
    + `20 日区间 ${n2(ind.donchian?.lower)}~${n2(ind.donchian?.upper)}，52 周位置 ${ind.position52 ?? '—'}%。`
  ];
  if (quote?.peTtm != null) parts.push(`当前 PE(TTM) ${n2(quote.peTtm)} 倍。`);
  if (ind.channelVerdict?.advice) parts.push(ind.channelVerdict.advice);
  parts.push('本画像由实时行情自动生成，不含基本面与研报结论，仅用于技术面盯盘。');
  return parts.join('');
}

/** 由当前技术状态生成风险清单（每条都能对上一个真实指标，不写空话） */
function buildRisks(ind) {
  const out = [];
  const P = ind.price;
  if (ind.maArrangement === 'bear') out.push('均线空头排列，趋势性下行压力尚未解除，抄底需等待右侧信号。');
  if (ind.rsi != null && ind.rsi >= 80) out.push(`RSI(14) 已达 ${n2(ind.rsi)}，短线超买，存在技术性回调压力。`);
  if (ind.rsi != null && ind.rsi <= 30) out.push(`RSI(14) 降至 ${n2(ind.rsi)}，弱势格局，超卖不等于见底。`);
  if (ind.bollInfo && ind.bollInfo.pctB <= 0) out.push('价格已跌破布林下轨，弱势延续风险偏高。');
  if (ind.rails && ind.rails.reliable && ind.rails.dir === 'down') out.push('处于下降导轨，趋势未反转前反弹属减仓窗口而非买点。');
  if (ind.drawdownFromHigh != null && ind.drawdownFromHigh <= -20) {
    out.push(`距 52 周高点回撤 ${n2(Math.abs(ind.drawdownFromHigh))}%，上方套牢盘构成压力。`);
  }
  if (ind.atrPct != null && ind.atrPct >= 4) out.push(`日均波动率 ATR 达 ${ind.atrPct}%，波动偏大，须按 ATR 设置动态止损。`);
  if (ind.rsi != null && ind.rsi >= 70 && ind.rsi < 80) out.push('RSI 位于 70–80 偏热区，追高的赔率不佳。');
  out.push('⚠️ 自动画像不含投研结论与机构观点，关键决策请自行核实并独立判断。');
  return out.slice(0, 6);
}

/**
 * 为任意标的生成自动画像。
 * @param {Object} ctx  { ind, quote, flow, minutes, market, code, name }
 */
function synthesizeProfile(ctx) {
  const { ind, quote } = ctx;
  if (!ind) return null;

  const code = ctx.code || quote?.code || ind.code || '—';
  const name = ctx.name || quote?.name || code;
  const levels = deriveLevels(ind);
  const rows = monitors.buildGeneric(ctx);

  return {
    code,
    market: ctx.market || quote?.market || null,
    name,
    tags: buildTags({ ...ind, market: ctx.market || quote?.market }),
    sourceDoc: AUTO_SOURCE,
    reportDate: null,
    thesis: buildThesis(name, code, ind, quote),

    // 无研报依据 → 不编造护城河与合理估值区间
    moat: null,
    valuation: quote?.peTtm != null || quote?.pb != null
      ? { benchmark: '腾讯行情实时快照', note: '自动画像不提供"合理估值区间"判断，请结合行业自行核对' }
      : null,

    levels,
    cost: null,            // 无持仓，不得伪造成本
    takeProfit: [],
    catalysts: [],
    businessMix: [],
    monitors: rows,        // 清单即通用技术清单
    fundamentals: {
      peTtm: quote?.peTtm ?? null, pb: quote?.pb ?? null,
      totalCap: quote?.totalCap ?? null, floatCap: quote?.floatCap ?? null,
      turnover: quote?.turnover ?? null, volumeRatio: quote?.volumeRatio ?? null,
      position52: ind.position52 ?? null, drawdownFromHigh: ind.drawdownFromHigh ?? null,
      atrPct: ind.atrPct ?? null,
      source: '实时行情自动汇总'
    },
    chips: null,
    risks: buildRisks(ind),
    verdictNote: null,

    /* ---- 诚信标记 ---- */
    auto: true,
    profileQuality: AUTO_QUALITY,
    disclaimer: AUTO_SOURCE
  };
}

module.exports = { deriveLevels, synthesizeProfile, AUTO_QUALITY, AUTO_SOURCE, clamp };
