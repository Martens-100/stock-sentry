'use strict';
/**
 * 监控清单脚手架（monitors）
 * ================================================================
 * 统一「专项清单（来自投研文档）」与「通用清单（由实时行情派生）」的字段契约与求值方式。
 *
 * 为什么需要这一层：
 *   1. 此前专项清单与通用清单是两套结构 —— 前者只有 valuationPE 一个求值器能被自动判定，
 *      其余 auto 键（grossMargin / profitGrowth / ...）声明了却没人实现，于是永远静默不触发；
 *      后者（通用清单）压根不产出信号，只输出一句 now 文本。
 *   2. 结果就是"清单里写了该盯什么，但盯出结果来了系统不会有任何反应"。
 *
 * 本模块把「清单项」抽象成一个带求值器的声明式结构：
 *
 *   { key, dim, metric, window, bull, bear, weight, auto, state, note, evidence }
 *
 *   - bull/bear   : 人话口径，直接展示给用户（看什么算好 / 什么算坏）
 *   - auto        : 求值器键名，指向 EVALUATORS 里的纯函数，用来判定当前处于哪一侧
 *   - state       : 求值结果 —— bull | bear | neutral | pending | na
 *   - note        : 当前实测状态（给人看）
 *   - evidence    : 判定依据（给信号用）
 *
 * 「pending」用于"口径已声明、但当前数据源给不出判定"的项（例如需要季报的毛利率），
 * 显式暴露而不是静默不触发 —— 这是审查阶段发现的主要缺陷。
 *
 * 约束：本文件会进浏览器产物，禁止 require Node 模块、禁止读进程环境。
 */

/* ================================================================== */
/* 字段契约                                                            */
/* ================================================================== */
const FIELDS = ['key', 'dim', 'metric', 'window', 'bull', 'bear', 'weight', 'auto', 'state', 'note', 'evidence'];

/** 清单项状态 */
const STATES = {
  bull: { key: 'bull', label: '看多', color: '#c62828', sign: 1 },
  bear: { key: 'bear', label: '看空', color: '#12855a', sign: -1 },
  neutral: { key: 'neutral', label: '中性', color: '#b4740a', sign: 0 },
  pending: { key: 'pending', label: '待复核', color: '#7a828f', sign: 0 },
  manual: { key: 'manual', label: '人工跟踪', color: '#6b7280', sign: 0 },
  inapplicable: { key: 'inapplicable', label: '不适用', color: '#7a828f', sign: 0 },
  na: { key: 'na', label: '数据不足', color: '#7a828f', sign: 0 }
};

const stateLabel = (s) => (STATES[s] || STATES.na).label;
const stateColor = (s) => (STATES[s] || STATES.na).color;

/** 是否参与评分：neutral 要参与（用于稀释），其余状态不参与 */
const isScorable = (s) => s === 'bull' || s === 'bear' || s === 'neutral';
/** 是否已触发（真正出方向） */
const isTriggered = (s) => s === 'bull' || s === 'bear';

const n2 = (v) => (v == null || !Number.isFinite(v) ? '—' : Number(v).toFixed(2));
const p1 = (v) => (v == null || !Number.isFinite(v) ? '—' : Number(v).toFixed(1));
const pctStr = (v) => (v == null || !Number.isFinite(v) ? '—' : `${v > 0 ? '+' : ''}${Number(v).toFixed(2)}%`);

/* ================================================================== */
/* 求值器注册表                                                        */
/* ================================================================== */
/**
 * 每个求值器是纯函数 (ctx) -> { state, strength, note, evidence }
 *   strength: 1..5，用于 scoreSignals 的方向强度（state=neutral 时可省略）
 * ctx: { ind, quote, flow, profile, minutes }
 */

const EVALUATORS = {
  /* ---- 行情可直接判定（通用清单使用） ---- */

  /** 1. 趋势结构：均线排列 + 价格与长均线的相对位置 */
  trend(ctx) {
    const { ind } = ctx;
    const ma = ind.ma || {};
    const a = ind.maArrangement;
    const aboveBoth = ma.ma20 != null && ma.ma60 != null && ind.price > ma.ma20 && ind.price > ma.ma60;
    const belowBoth = ma.ma20 != null && ma.ma60 != null && ind.price < ma.ma20 && ind.price < ma.ma60;
    const ev = `MA5 ${n2(ma.ma5)} / MA10 ${n2(ma.ma10)} / MA20 ${n2(ma.ma20)} / MA60 ${n2(ma.ma60)}，现价 ${n2(ind.price)}`;

    if (a === 'bull') return { state: 'bull', strength: 4, note: '多头排列', evidence: ev };
    if (a === 'bear') return { state: 'bear', strength: 4, note: '空头排列', evidence: ev };
    if (aboveBoth) return { state: 'bull', strength: 2, note: '均线纠缠，但价格站上 MA20 与 MA60', evidence: ev };
    if (belowBoth) return { state: 'bear', strength: 3, note: '均线纠缠，且价格跌破 MA20 与 MA60', evidence: ev };
    return { state: 'neutral', strength: 0, note: '均线纠缠，方向未选择', evidence: ev };
  },

  /** 2. 中期支撑：价格相对 MA20 的偏离度 */
  ma20Support(ctx) {
    const { ind } = ctx;
    const ma20 = ind.ma?.ma20;
    if (ma20 == null) return { state: 'na', note: 'MA20 不可用', evidence: '' };
    const dev = ((ind.price - ma20) / ma20) * 100;
    const ev = `现价 ${n2(ind.price)} / MA20 ${n2(ma20)}，偏离 ${pctStr(dev)}`;
    if (dev < -2) return { state: 'bear', strength: 4, note: `已跌破 MA20 ${pctStr(dev)}，支撑失守`, evidence: ev };
    if (dev >= 0 && dev <= 8) return { state: 'bull', strength: 3, note: `站稳 MA20 上方 ${pctStr(dev)}，支撑有效`, evidence: ev };
    if (dev > 8) return { state: 'neutral', strength: 0, note: `位于 MA20 上方 ${pctStr(dev)}，乖离偏大，回踩确认后赔率更佳`, evidence: ev };
    return { state: 'neutral', strength: 0, note: `贴近 MA20（${pctStr(dev)}），方向待确认`, evidence: ev };
  },

  /** 3. MACD 动能：金叉/死叉 + 零轴 + 红绿柱变化 */
  macd(ctx) {
    const { ind } = ctx;
    const m = ind.macd;
    if (!m || m.dif == null || m.dea == null) return { state: 'na', note: 'MACD 不可用', evidence: '' };
    const up = m.dif > m.dea;
    const above = m.dif > 0;
    const histUp = m.prevHist != null && m.hist != null ? m.hist > m.prevHist : null;
    const ev = `DIF ${n2(m.dif)} / DEA ${n2(m.dea)}，柱 ${n2(m.hist)}${histUp == null ? '' : histUp ? '（较前值放大）' : '（较前值收敛）'}`;

    if (up && above) return { state: 'bull', strength: histUp ? 4 : 3, note: 'DIF 在 DEA 上方且站上零轴，多头动能', evidence: ev };
    if (up && !above) return { state: 'bull', strength: 2, note: '零轴下方金叉，属弱多修复', evidence: ev };
    if (!up && !above) return { state: 'bear', strength: 4, note: 'DIF 在 DEA 下方且位于零轴下，空头动能', evidence: ev };
    return { state: 'bear', strength: 2, note: '零轴上方死叉，属强势回调', evidence: ev };
  },

  /** 4. RSI 强弱 */
  rsi(ctx) {
    const { ind } = ctx;
    const r = ind.rsi;
    if (r == null) return { state: 'na', note: 'RSI 不可用', evidence: '' };
    const rp = ind.rsiPrev;
    const ev = `RSI(14) ${n2(r)}${rp == null ? '' : `（前值 ${n2(rp)}）`}`;

    if (rp != null && rp >= 80 && r < rp) return { state: 'bear', strength: 4, note: `自超买区 ${n2(rp)} 掉头至 ${n2(r)}`, evidence: ev };
    if (r >= 80) return { state: 'bear', strength: 3, note: '超买区（≥80），追高风险大', evidence: ev };
    if (r <= 30) return { state: 'bear', strength: 4, note: '超卖区（≤30），弱势格局，关注反弹确认', evidence: ev };
    if (r >= 50) return { state: 'bull', strength: r >= 70 ? 2 : 3, note: r >= 70 ? '强势区（70–80），偏热但仍在多头一侧' : 'RSI 站上 50，多头一侧', evidence: ev };
    return { state: 'neutral', strength: 0, note: 'RSI 位于 30–50 弱势震荡区，未站上 50', evidence: ev };
  },

  /** 5. 布林轨道 */
  boll(ctx) {
    const { ind } = ctx;
    const bi = ind.bollInfo;
    if (!bi || bi.pctB == null) return { state: 'na', note: '布林轨道不可用', evidence: '' };
    const pb = bi.pctB;
    const ev = `%B ${(pb * 100).toFixed(0)}%，带宽 ${p1(bi.bandwidthPct)}%（历史分位 ${bi.bandwidthPctile ?? '—'}%），${bi.stateLabel}`;
    const squeezeNote = bi.state === 'squeeze' ? '；带宽收口，变盘临近' : bi.state === 'expand' ? '；带宽开口，趋势加速' : '';

    if (pb <= 0) return { state: 'bear', strength: 4, note: `跌破布林下轨（%B ${(pb * 100).toFixed(0)}%）${squeezeNote}`, evidence: ev };
    if (pb >= 1) return { state: 'bull', strength: 2, note: `运行于上轨之上（%B ${(pb * 100).toFixed(0)}%），强势但短期待修复${squeezeNote}`, evidence: ev };
    if (pb >= 0.5) return { state: 'bull', strength: 3, note: `站上布林中轨（%B ${(pb * 100).toFixed(0)}%）${squeezeNote}`, evidence: ev };
    return { state: 'bear', strength: 2, note: `位于布林中轨下方（%B ${(pb * 100).toFixed(0)}%）${squeezeNote}`, evidence: ev };
  },

  /** 6. 回归导轨 */
  rails(ctx) {
    const { ind } = ctx;
    const ra = ind.rails;
    if (!ra) return { state: 'na', note: '导轨不可用', evidence: '' };
    if (!ra.reliable) return { state: 'na', note: '导轨宽度过大、有效性不足，本次不计入判定', evidence: `斜率 ${p1(ra.slope20Pct)}%/20日` };
    const rp = ra.pctChan;
    const dirLabel = ra.dir === 'up' ? '上升导轨' : ra.dir === 'down' ? '下降导轨' : '水平导轨';
    const ev = `${dirLabel}｜通道位 ${(rp * 100).toFixed(0)}%｜下轨 ${n2(ra.dn)} / 上轨 ${n2(ra.up)}｜斜率 ${p1(ra.slope20Pct)}%/20日`;

    if (ra.dir === 'up' && rp < 0.45) return { state: 'bull', strength: 4, note: `上升导轨回调至通道下部（${(rp * 100).toFixed(0)}%），低吸区间`, evidence: ev };
    if (ra.dir === 'up' && rp >= 0.75) return { state: 'neutral', strength: 0, note: `上升导轨上沿（${(rp * 100).toFixed(0)}%），趋势强但赔率下降，宜持有不追`, evidence: ev };
    if (ra.dir === 'down' && rp <= 0.2) return { state: 'bear', strength: 4, note: `下降导轨下沿（${(rp * 100).toFixed(0)}%），趋势未反转，不宜抄底`, evidence: ev };
    if (ra.dir === 'down' && rp >= 0.75) return { state: 'bear', strength: 3, note: `反抽至下降导轨上沿（${(rp * 100).toFixed(0)}%），属减仓窗口`, evidence: ev };
    if (ra.dir === 'flat' && rp <= 0.25) return { state: 'bull', strength: 3, note: `箱体底部（${(rp * 100).toFixed(0)}%），区间低吸位`, evidence: ev };
    if (ra.dir === 'flat' && rp >= 0.75) return { state: 'bear', strength: 3, note: `箱体顶部（${(rp * 100).toFixed(0)}%），区间减持位`, evidence: ev };
    return { state: 'neutral', strength: 0, note: `通道中部（${(rp * 100).toFixed(0)}%），方向未选择`, evidence: ev };
  },

  /** 7. 量价配合 */
  volume(ctx) {
    const { ind, quote } = ctx;
    const vr = quote?.volumeRatio ?? ind.volRatioLocal;
    if (vr == null) return { state: 'na', note: '量比不可用', evidence: '' };
    const chg = quote?.changePct ?? ind.returns?.d1;
    const ev = `量比 ${n2(vr)}${chg == null ? '' : `，当日涨跌 ${pctStr(chg)}`}${quote?.turnover == null ? '' : `，换手 ${quote.turnover}%`}`;

    if (vr >= 1.5 && chg != null && chg > 0) return { state: 'bull', strength: 3, note: '放量上涨，量价配合', evidence: ev };
    if (vr >= 1.5 && chg != null && chg < 0) return { state: 'bear', strength: 4, note: '放量下跌，抛压释放', evidence: ev };
    if (vr >= 1.5) return { state: 'neutral', strength: 0, note: '明显放量但方向不明', evidence: ev };
    if (vr <= 0.7) return { state: 'neutral', strength: 0, note: '明显缩量，观望情绪浓', evidence: ev };
    return { state: 'neutral', strength: 0, note: '量能正常，无明显方向性含义', evidence: ev };
  },

  /** 8. 关键区间：唐奇安 20 日通道突破/破位 */
  donchian(ctx) {
    const { ind } = ctx;
    const dc = ind.donchian;
    if (!dc) return { state: 'na', note: '区间数据不足', evidence: '' };
    const P = ind.price;
    const ev = `现价 ${n2(P)}｜20日区间 ${n2(dc.lower)} ~ ${n2(dc.upper)}｜区间位置 ${p1(dc.pct)}%｜52周位置 ${p1(ind.position52)}%`;

    if (P > dc.upper) return { state: 'bull', strength: 4, note: `突破 20 日高点 ${n2(dc.upper)}`, evidence: ev };
    if (P < dc.lower) return { state: 'bear', strength: 4, note: `跌破 20 日低点 ${n2(dc.lower)}`, evidence: ev };
    if (dc.pct >= 90) return { state: 'bull', strength: 2, note: `逼近 20 日高点（区间位 ${p1(dc.pct)}%），等待有效突破`, evidence: ev };
    if (dc.pct <= 10) return { state: 'bear', strength: 2, note: `逼近 20 日低点（区间位 ${p1(dc.pct)}%），注意破位风险`, evidence: ev };
    return { state: 'neutral', strength: 0, note: `区间内震荡（位置 ${p1(dc.pct)}%）`, evidence: ev };
  },

  /** 9. 估值分位（专项清单使用，依赖行情 PE） */
  valuationPE(ctx) {
    const { ind, quote } = ctx;
    const pe = quote?.peTtm;
    if (pe == null) return { state: 'na', note: 'PE(TTM) 不可用', evidence: '' };
    const ev = `PE(TTM) ${n2(pe)} 倍（数据源：腾讯行情，现价 ${n2(ind.price)}）`;
    /* 亏损公司的 PE 为负，数值越小越"低"，机械套用「低 PE = 便宜」会得出完全相反的结论。
       正确做法是判定为不适用，不参与评分。 */
    if (pe <= 0) {
      return {
        state: 'inapplicable',
        note: `PE(TTM) ${n2(pe)} 倍为负，公司当前处于亏损状态，PE 不适用，需改用 PB 或 PS 判断`,
        evidence: ev
      };
    }
    if (pe < 30) return { state: 'bull', strength: 3, note: `${n2(pe)} 倍，处于偏低分位`, evidence: ev };
    if (pe > 50) return { state: 'bear', strength: 3, note: `${n2(pe)} 倍，估值透支风险上升`, evidence: ev };
    return { state: 'neutral', strength: 0, note: `${n2(pe)} 倍，估值中性`, evidence: ev };
  }
};

/**
 * 口径已声明、但当前数据源给不出判定的求值器键。
 * 显式登记 → 清单项标记为 pending「待复核」，而不是静默什么都不做。
 * 需要季报/股东数据，当前只接入实时行情与 K 线。
 */
const PENDING_KEYS = {
  grossMargin: '需要定期报告披露的综合毛利率',
  segmentShare: '需要定期报告的分业务营收占比',
  profitGrowth: '需要定期报告的单季归母净利润',
  revenueGrowth: '需要定期报告的营收与毛利率',
  chipConcentration: '需要股东户数/融资余额等筹码数据'
};

const hasEvaluator = (key) => typeof EVALUATORS[key] === 'function';

/* ================================================================== */
/* 通用清单定义（无研报画像时使用）                                     */
/* ================================================================== */
/**
 * 用实时技术状态生成一套与专项清单等价的盯盘清单。
 * 回答同样的三个问题：看什么、什么算好、什么算坏。
 * 每项都带 auto，因此能被 evaluate() 自动判定并产出信号。
 */
function buildGeneric(ctx) {
  const { ind } = ctx;
  if (!ind) return [];

  const ma = ind.ma || {};
  const dc = ind.donchian || {};
  const ra = ind.rails || {};
  const vr = ctx.quote?.volumeRatio ?? ind.volRatioLocal;

  return [
    {
      key: 'trend', auto: 'trend', dim: '趋势结构',
      metric: `MA20 ${n2(ma.ma20)} / MA60 ${n2(ma.ma60)}`,
      window: '每日收盘',
      bull: '价格站上 MA20，且 MA20 走平或上翘',
      bear: '收盘跌破 MA60，且 MA60 拐头向下',
      weight: 10
    },
    {
      key: 'ma20s', auto: 'ma20Support', dim: '中期支撑',
      metric: `MA20 支撑位 ${n2(ma.ma20)}`,
      window: '每日',
      bull: `回踩 ${n2(ma.ma20)} 附近不破并收出阳线`,
      bear: `有效跌破 ${n2(ma.ma20)}（收盘价连续 2 日在下方）`,
      weight: 9
    },
    {
      key: 'macd', auto: 'macd', dim: 'MACD 动能',
      metric: `DIF ${n2(ind.macd?.dif)} / DEA ${n2(ind.macd?.dea)}`,
      window: '每日',
      bull: 'DIF 上穿 DEA 形成金叉，且 DIF 站上零轴',
      bear: 'DIF 下穿 DEA 形成死叉，且绿柱持续放大',
      weight: 8
    },
    {
      key: 'rsi', auto: 'rsi', dim: 'RSI 强弱',
      metric: `RSI(14) ${n2(ind.rsi)}`,
      window: '每日',
      bull: 'RSI 上穿 50 并站稳',
      bear: 'RSI 跌破 30，或自 80 以上高位掉头',
      weight: 7
    },
    {
      key: 'boll', auto: 'boll', dim: '布林轨道',
      metric: `上轨 ${n2(ind.boll?.up)} / 中轨 ${n2(ind.boll?.mid)} / 下轨 ${n2(ind.boll?.dn)}`,
      window: '每日',
      bull: '收复中轨，并向中轨上方扩展',
      bear: '跌破下轨，或上轨遇阻后放量回落',
      weight: 8
    },
    {
      key: 'rails', auto: 'rails', dim: '回归导轨',
      metric: `导轨 ${n2(ra.dn)} ~ ${n2(ra.up)}（${ra.bars || '—'} 根，k=${ra.k ?? '—'}）`,
      window: '每日',
      bull: '上升导轨中回踩下沿获支撑',
      bear: '下降导轨中跌破下轨，趋势延续',
      weight: 8
    },
    {
      key: 'volume', auto: 'volume', dim: '量价配合',
      metric: `量比 ${vr == null ? '—' : n2(vr)} / 换手 ${ctx.quote?.turnover == null ? '—' : ctx.quote.turnover + '%'}`,
      window: '每日',
      bull: '放量突破关键阻力位（量比 > 1.5）',
      bear: '放量下跌或缩量反弹无力',
      weight: 7
    },
    {
      key: 'donchian', auto: 'donchian', dim: '关键区间',
      metric: dc.upper == null ? '20日区间数据不足' : `20日 ${n2(dc.lower)} ~ ${n2(dc.upper)}`,
      window: '每日',
      bull: '突破 20 日高点并有效站稳',
      bear: '跌破 20 日低点',
      weight: 7
    }
  ];
}

/* ================================================================== */
/* 求值主流程                                                          */
/* ================================================================== */
/**
 * 对清单逐项求值，返回带状态的清单行 + 可参与评分的信号。
 *
 * @param {Array}  monitors 清单项（通用或专项）
 * @param {Object} ctx      分析上下文 { ind, quote, flow, profile, minutes }
 * @param {Object} [opt]
 *   @param {string} [opt.origin='monitor'] 产出信号的 origin，专项清单应传 'profile'
 * @returns {{ rows: Array, signals: Array, triggered: number, pending: number }}
 */
function evaluate(monitors, ctx, opt = {}) {
  const origin = opt.origin || 'monitor';
  const rows = [];
  const signals = [];
  let triggered = 0;
  let pending = 0;
  let manual = 0;

  for (const m of monitors || []) {
    const key = m.key || m.auto || null;
    /* 求值器只认 auto —— 专项清单的 key 只是标识符，
       不能因为恰好同名就被行情求值器接管 */
    const autoKey = m.auto || null;

    let r = null;
    let unresolved = null;

    if (hasEvaluator(autoKey)) {
      try {
        r = EVALUATORS[autoKey](ctx);
      } catch (e) {
        r = { state: 'na', note: `求值异常：${e && e.message ? e.message : '未知错误'}`, evidence: '' };
      }
    } else if (autoKey && PENDING_KEYS[autoKey]) {
      unresolved = PENDING_KEYS[autoKey];
    } else if (autoKey) {
      unresolved = `未登记的求值器 ${autoKey}`;
    }

    /* pending = 口径已声明但缺数据源；manual = 压根没有自动判定口径，需人工跟踪 */
    const state = r ? (r.state || 'na') : autoKey ? 'pending' : 'manual';
    const note = r ? (r.note || '—')
      : autoKey ? `口径已声明，暂缺数据源：${unresolved}`
        : '需人工跟踪：该口径无法由行情数据自动判定';
    const evidence = r ? (r.evidence || '') : '';

    rows.push({ ...m, key, state, note, evidence, triggered: isTriggered(state) });

    if (!isScorable(state)) {
      if (state === 'pending') pending += 1;
      if (state === 'manual') manual += 1;
      continue;
    }

    const side = state === 'bull' ? 'bull' : state === 'bear' ? 'bear' : 'neutral';
    const strength = side === 'neutral' ? 0 : Math.max(1, Math.min(5, r.strength ?? 3));
    if (side !== 'neutral') triggered += 1;

    signals.push({
      id: `mon-${key}`,
      dim: m.dim || '监控清单',
      name: m.metric || m.dim || key,
      side,
      strength,
      weight: m.weight ?? 5,
      text: side === 'bull' ? m.bull : side === 'bear' ? m.bear : `未触发：${m.bull} / ${m.bear}`,
      evidence: evidence || note,
      origin
    });
  }

  return { rows, signals, triggered, pending, manual };
}

/**
 * 清单概览：给 UI/报告用的一句话结论。
 * 评价只在"可判定项"(total) 上做，同时把 pending / manual / inapplicable 如实暴露，
 * 避免用"多数项未触发"掩盖"其实大部分项压根没法自动判定"。
 */
function summarize(rows) {
  const list = rows || [];
  const cnt = (s) => list.filter((r) => r.state === s).length;
  const bull = cnt('bull'), bear = cnt('bear'), neutral = cnt('neutral');
  const pending = cnt('pending'), manual = cnt('manual');
  const inapplicable = cnt('inapplicable'), na = cnt('na');
  const total = bull + bear + neutral;

  let verdict = '无可自动判定项，清单需人工跟踪';
  if (total) {
    if (bull >= bear + 2) verdict = `看多项占优（${bull} 看多 / ${bear} 看空）`;
    else if (bear >= bull + 2) verdict = `看空项占优（${bull} 看多 / ${bear} 看空）`;
    else verdict = `多空交织（${bull} 看多 / ${bear} 看空 / ${neutral} 中性）`;
  }

  const gaps = [];
  if (pending) gaps.push(`${pending} 项待复核（缺数据源）`);
  if (manual) gaps.push(`${manual} 项需人工跟踪`);
  if (inapplicable) gaps.push(`${inapplicable} 项不适用`);
  if (na) gaps.push(`${na} 项数据不足`);

  return {
    bull, bear, neutral, pending, manual, inapplicable, na, total,
    judgeable: total, listed: list.length,
    verdict,
    gapNote: gaps.length ? `另有 ${gaps.join('、')}，未计入评分。` : ''
  };
}

module.exports = {
  FIELDS, STATES, stateLabel, stateColor, isScorable, isTriggered,
  EVALUATORS, PENDING_KEYS, hasEvaluator,
  buildGeneric, evaluate, summarize,
  n2
};
