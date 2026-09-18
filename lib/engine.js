'use strict';
/**
 * 分析引擎：把行情、指标、信号、画像合成为「入场/离场」明确结论
 */
const src = require('./source');
const tech = require('./tech');
const rules = require('./rules');
const monitors = require('./monitors');
const portrait = require('./portrait');
const profilesData = require('../data/profiles.json');

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const r2 = (x) => (Number.isFinite(x) ? +x.toFixed(2) : null);

/** 无研报画像时，技术面与监控面在综合评分中的权重 */
const AUTO_W_TECH = 0.6;

function getProfile(code) {
  const c = src.normalize(code).code;
  return profilesData.profiles[c] || null;
}

/* --------------------------- 动作判定 --------------------------- */
const ACTIONS = {
  BUY: { key: 'BUY', label: '积极入场', color: '#c62828', desc: '多项核心信号共振向上，且价格处于策略允许的买入区间' },
  ADD: { key: 'ADD', label: '可分批建仓', color: '#e53935', desc: '技术面与策略面偏多，可逢低分批介入' },
  HOLD: { key: 'HOLD', label: '持有观察', color: '#f9a825', desc: '多空信号交织，未到明确买卖点，保持现有仓位观察' },
  WATCH: { key: 'WATCH', label: '观望等待', color: '#fb8c00', desc: '方向不明或处于左侧磨底，等待右侧确认信号' },
  REDUCE: { key: 'REDUCE', label: '建议减仓', color: '#2e7d32', desc: '利空信号占优，应降低仓位控制回撤' },
  EXIT: { key: 'EXIT', label: '建议离场', color: '#1b5e20', desc: '趋势与风控双双恶化，应果断离场保护本金' },
  TAKE_PROFIT: { key: 'TAKE_PROFIT', label: '分批止盈', color: '#6d4c41', desc: '已达目标位或短线过热，应分批兑现利润' },
  // 无持仓场景下的等价动作（避免对未持仓标的输出"离场""止盈"等误导性措辞）
  AVOID: { key: 'AVOID', label: '建议回避', color: '#1b5e20', desc: '趋势与风控双双恶化，暂不建议参与，等待右侧信号确认' },
  NOCHASE: { key: 'NOCHASE', label: '不建议追高', color: '#6d4c41', desc: '价格已临近或触及目标区间，此时介入的赔率不佳，建议等待回调' }
};

/** 无持仓时把持仓动作转换为等价的无持仓表述 */
function adaptForNoPosition(action) {
  if (action.key === 'EXIT') return { ...ACTIONS.AVOID, reasons: action.reasons, confidence: action.confidence };
  if (action.key === 'TAKE_PROFIT') return { ...ACTIONS.NOCHASE, reasons: action.reasons, confidence: action.confidence };
  if (action.key === 'REDUCE') {
    return { ...ACTIONS.AVOID, label: '建议减持/回避', desc: '利空信号占优，建议降低或暂缓建立敞口', reasons: action.reasons, confidence: action.confidence };
  }
  return action;
}

function decideAction({ composite, techScore, profileScore, ind, profile, signals }) {
  const P = ind.price;
  /* 自动画像的价位是否参与硬性风控判定：
     自动画像的 stopLoss/target 由 portrait.deriveLevels 按「当前价 + ATR 偏移」反推，
     而 deriveLevels 每次分析都用最新价重算 —— 因此这些价位与现价始终维持固定偏移，
     无法作为"价格触达即触发"的硬止损/目标信号（实测：价格逐档上行时 target1 始终比
     现价高一个 floor，aboveT1 永远为 false，详见 feat/p4 验证）。
     自动画像的实时风控由 monitors 系统承接（MA20 / Donchian / Bollinger 等按 K 线固定
     参考位判定，能真实触发）。故此处对 auto 置空 L，仅投研画像的静态价位参与硬性风控。 */
  const L = profile?.auto ? {} : (profile?.levels || {});
  const reasons = [];
  let action;

  // 硬性风控优先
  const belowHard = L.hardStop && P <= L.hardStop;
  const belowStop = L.stopLoss && P <= L.stopLoss;
  const aboveT1 = L.target1 && P >= L.target1;
  const aboveT2 = L.target2 && P >= L.target2;

  if (belowHard) {
    action = ACTIONS.EXIT;
    reasons.push(`价格 ${P} 已跌破硬止损位 ${L.hardStop}，按报告风控纪律应无条件清仓，本金安全优先于任何反弹预期。`);
  } else if (belowStop) {
    action = ACTIONS.EXIT;
    reasons.push(`价格 ${P} 已跌破止损位 ${L.stopLoss}，若 3 个交易日内无法收回，应执行止损离场。`);
  } else if (aboveT2) {
    action = ACTIONS.TAKE_PROFIT;
    reasons.push(`价格 ${P} 已达第二目标位 ${L.target2}，建议再减仓 1/3 并保留底仓，用移动止盈锁定利润。`);
  } else if (aboveT1) {
    action = ACTIONS.TAKE_PROFIT;
    reasons.push(`价格 ${P} 已达第一目标位 ${L.target1}，若成交量萎缩应减仓 1/3。`);
  } else if (composite >= 78) {
    action = ACTIONS.BUY;
  } else if (composite >= 66) {
    action = ACTIONS.ADD;
  } else if (composite >= 52) {
    action = ACTIONS.HOLD;
  } else if (composite >= 40) {
    action = ind.maArrangement === 'bull' ? ACTIONS.REDUCE : ACTIONS.WATCH;
  } else {
    action = ACTIONS.EXIT;
  }

  // 补足理由
  const bulls = signals.filter((s) => s.side === 'bull').sort((a, b) => b.strength * b.weight - a.strength * a.weight);
  const bears = signals.filter((s) => s.side === 'bear').sort((a, b) => b.strength * b.weight - a.strength * a.weight);
  bulls.slice(0, 3).forEach((s) => reasons.push(`【支撑】${s.name}：${s.text}（${s.evidence}）`));
  bears.slice(0, 3).forEach((s) => reasons.push(`【压制】${s.name}：${s.text}（${s.evidence}）`));
  reasons.push(`综合评分 ${composite}（技术面 ${techScore} / 策略面 ${profileScore ?? '—'}），结论落于「${action.label}」区间。`);

  return { ...action, reasons, confidence: clamp(Math.round(Math.abs(composite - 50) * 1.8 + 20), 20, 95) };
}

/* --------------------------- 交易计划 --------------------------- */
function buildPlan(ind, profile, actionKey) {
  const P = ind.price;
  /* 与 rules.profileRules / decideAction 一致：自动画像的价位只是 ATR 反推，
     不能冒充研报价位参与建仓/止损推导，统一回落到 portrait.deriveLevels 的口径 */
  const L = profile?.auto ? {} : (profile?.levels || {});
  const atr = ind.atr || P * 0.02;

  /* 支撑/阻力与价位兜底的推导统一收敛到 portrait.deriveLevels，
     避免同一套「ATR + 关键位」逻辑在引擎与画像里各写一遍而产生口径漂移 */
  const d = portrait.deriveLevels(ind);
  const supports = d.supports;
  const resistances = d.resistances;

  const entryLo = L.entry?.[0] ?? d.entry[0];
  const entryHi = L.entry?.[1] ?? d.entry[1];
  const stopLoss = L.stopLoss ?? d.stopLoss;
  const hardStop = L.hardStop ?? d.hardStop;
  // 派生目标位已在 deriveLevels 内保证与现价保持 ≥ 贴脸阈值（max(3×ATR, 6% 现价)）距离，避免"贴脸"导致盈亏比失真
  const target1 = L.target1 ?? d.target1;
  let target2 = L.target2 ?? d.target2;
  /* 职责分工：此处只防"倒挂"（target2 不高于 target1），不做最小间距约束。
     L.target2 可能来自 data/profiles.json 的研报价位，属投研权威值，引擎不擅自改写；
     派生来源（d.target2）的最小间距已由 portrait.deriveLevels 的 minTgtGap 保证。 */
  if (target2 == null || target2 <= target1) target2 = r2(target1 + atr * 3);

  /* 盈亏比：以「参考入场价」为基准，而非机械用现价 */
  let refEntry = P;
  if (L.entry) {
    const [lo, hi] = L.entry;
    refEntry = P <= hi ? Math.max(P, lo) : hi;   // 现价在区间内则按现价，高于区间则按区间上沿（等回踩）
  }
  let refStop = stopLoss;
  if (refStop != null && refEntry <= refStop && hardStop) refStop = hardStop;  // 入场价已低于止损位时改用硬止损

  const riskDist = refStop != null ? refEntry - refStop : null;
  const wideEnough = riskDist != null && riskDist >= atr * 0.8;
  const rrRaw = (wideEnough && target1 > refEntry) ? (target1 - refEntry) / riskDist : null;
  const riskReward = rrRaw != null ? +rrRaw.toFixed(2) : null;
  const rrNote = riskReward != null
    ? `按参考入场价 ${r2(refEntry)} 元、止损 ${r2(refStop)} 元计算（风险 ${r2(riskDist)} 元 ≈ ${(riskDist / atr).toFixed(1)}×ATR）`
    : (riskDist != null && !wideEnough
      ? `参考入场价 ${r2(refEntry)} 元距止损 ${r2(refStop)} 元仅 ${r2(riskDist)} 元，不足 1×ATR（${r2(atr)}），止损过窄、盈亏比参考意义有限，建议按 ATR 设置动态止损`
      : '现价已高于目标位或低于止损位，盈亏比不适用');

  const positionPct = L.positionLimit ? Math.round(L.positionLimit * 100) : 10;
  const batchKind = ['BUY', 'ADD'].includes(actionKey) ? 'entry'
    : ['HOLD', 'WATCH'].includes(actionKey) ? 'conditional' : 'exit';

  /* 分批买入：按价格由高到低递进加仓，越跌买得越多 */
  const zoneLo = entryLo != null ? Math.min(entryLo, entryHi ?? entryLo) : null;
  const zoneHi = entryHi != null ? Math.max(entryLo, entryHi) : null;
  let batches;
  if (L.entry && zoneLo != null) {
    if (P > zoneHi) {
      const mid = r2((zoneLo + zoneHi) / 2);
      batches = [
        { at: `回落至 ${zoneHi} 元附近（建仓区间上沿）`, ratio: '30%', note: '回到策略区间再动手，不追高' },
        { at: `${mid} 元附近（区间中枢）`, ratio: '30%', note: '区间中部承接，摊薄成本' },
        { at: `${zoneLo} 元附近（区间下沿）`, ratio: '40%', note: '接近下沿，风险收益比最优' }
      ];
    } else if (P >= zoneLo) {
      batches = [
        { at: `${r2(P)} 元（现价，区间内）`, ratio: '30%', note: '首笔试仓，验证逻辑' },
        { at: `${zoneLo} 元附近（区间下沿）`, ratio: '30%', note: '回踩下沿不破则加仓' },
        { at: `${r2(zoneLo - atr)} 元附近（下沿 -1 ATR）`, ratio: '40%', note: '跌破下沿后的深水区，仅在逻辑未破坏时执行' }
      ];
    } else {
      batches = [
        { at: `${r2(P)} 元（现价，已低于区间下沿）`, ratio: '30%', note: '先确认基本面/预期未恶化，再小仓试错' },
        { at: `${r2(P - atr)} 元附近（-1 ATR）`, ratio: '30%', note: '继续下跌需重新核对投资逻辑' },
        { at: `${r2(P - atr * 2)} 元附近（-2 ATR）`, ratio: '40%', note: '若跌破硬止损 ${hardStop} 元则放弃该计划' }
      ];
    }
  } else {
    batches = [
      { at: `${r2(P)} 元（现价）`, ratio: '30%', note: '轻仓试错' },
      { at: `${r2(P - atr)} 元附近（-1 ATR）`, ratio: '30%', note: '回踩确认支撑后加仓' },
      { at: `${r2(P - atr * 2)} 元附近（-2 ATR）`, ratio: '40%', note: '跌深后分批承接' }
    ];
  }

  const exitBatches = actionKey === 'TAKE_PROFIT'
    ? [
      { at: `${target1} 元（第一目标位）`, ratio: '1/3', note: '达标且量能萎缩即减仓，落袋为安' },
      { at: `${target2 ?? r2(target1 * 1.08)} 元（第二目标位）`, ratio: '1/3', note: '放量突破可再减，剩余底仓用移动止盈跟随' },
      { at: `跌破 ${r2(P - atr * 1.5)} 元（-1.5 ATR）`, ratio: '剩余全部', note: '移动止盈触发，回吐超过阈值即离场' }
    ]
    : actionKey === 'REDUCE'
      ? [
        { at: `反弹至 ${r2(P + atr)} 元附近`, ratio: '1/3', note: '利用技术性反弹降低仓位，而非恐慌抛售' },
        { at: `${stopLoss ?? r2(P - atr * 2)} 元附近（止损位）`, ratio: '1/3', note: '跌破止损位则加快减仓节奏' },
        { at: `${hardStop ?? r2(P - atr * 3.5)} 元（硬止损）`, ratio: '剩余全部', note: '硬止损触发，无条件清仓' }
      ]
      : [
        { at: `${r2(P)} 元（现价）`, ratio: '50%', note: '风控优先，先降低一半敞口' },
        { at: `反弹至 ${ind.ma.ma20 ?? r2(P + atr)} 元附近`, ratio: '剩余全部', note: '反弹是减仓窗口而非补仓理由' },
        { at: `${hardStop ?? r2(P - atr * 3.5)} 元（硬止损）`, ratio: '无条件清仓', note: '跌破硬止损立即离场，不做任何摊薄' }
      ];

  return {
    entry: [entryLo, entryHi],
    stopLoss, hardStop, target1, target2,
    riskReward, rrNote, riskPct: r2(riskDist != null ? (riskDist / refEntry) * 100 : null), refEntry: r2(refEntry),
    atr: r2(atr), atrPct: ind.atrPct,
    supports, resistances,
    positionLimitPct: positionPct,
    fromProfile: !!(L.entry || L.stopLoss) && !profile?.auto,
    levelsSource: (!profile?.auto && (L.entry || L.stopLoss)) ? 'profile' : 'derived',
    canEnter: batchKind !== 'exit',
    batches: batchKind === 'exit' ? exitBatches : batches,
    batchKind
  };
}

/* --------------------------- 图表载荷 ---------------------------
 * 这一段的存在理由，是一次真实的线上现象：K 线图与「上下轨线与导轨区间研判」
 * 整块显示为空。排查后发现根因不在画布，而在**载荷的对齐契约**上：
 *
 *   1) 三条序列各自独立截断（kline 切 120 根、boll 切 120 根、
 *      rails 只带末段 45~60 根），客户端只能靠「长度相减」去猜偏移
 *      （railOffset = k.length - rail.bars）。这个等式今天恰好成立，
 *      但它是一个**没有被任何东西保证的隐式契约**：只要哪天截断长度变了、
 *      导轨自适应窗口变了、或某条序列前补了 null，等式就悄悄不成立 ——
 *      导轨会被画到画布之外，看起来就是「导轨图像为空」，而且不报任何错。
 *   2) kline 为空或过短时（接口限流、停牌、次新不足窗口），
 *      computeIndicators 会算出全 null 的 boll 与 null 的 rails，
 *      下游 drawKline 直接 `if (!k.length) return` 静默收工，
 *      renderChannel 的 railRow 又用 `if (!(hi > lo)) return ''` 静默丢行 ——
 *      于是「空」既没有图，也没有一句话解释。
 *
 * 所以这里做三件事：把三条序列**统一到同一次截断**（长度严格相等、下标一一对应）、
 * 偏移**显式写进载荷**（并附带 dates 让客户端能按日期二次校验）、
 * 数据不足时给出结构化的 degraded 说明，让渲染层有话可说。
 */
const CHART_BARS = 120;

/** 取末 n 项；不足则**前补 null** —— 补齐而不是截短，才能保证下标与 K 线一一对应 */
function alignedTail(arr, n) {
  const a = Array.isArray(arr) ? arr : [];
  if (n <= 0) return [];
  if (a.length >= n) return a.slice(-n);
  return new Array(n - a.length).fill(null).concat(a);
}

/** 以 A 股市场的东八区日期为准取「今天」；优先用行情自带的日期（那是数据源的口径） */
function dayKeyFromQuote(q) {
  const t = q && q.time;
  if (typeof t === 'string') {
    const m = t.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * 把「当日实时行情」并入日 K —— 必须发生在**算指标之前**。
 *
 * 为什么关键：布林上下轨与回归导轨完全由收盘价序列推导。只要当日这根还是
 * 昨日收盘（或干脆没有），上下轨与导轨就会稳稳停在昨天的位置上 ——
 * 用户看到的是「图像不随实时状态更新」，而不是「图像算错了」，
 * 这种错法不会抛异常、不会报错，只会让人以为指标没画出来。
 */
function mergeTodayBar(kline, quote) {
  const bars = Array.isArray(kline) ? kline.slice() : [];
  const price = quote && quote.price;
  if (!Number.isFinite(price) || price <= 0) return { bars, merged: false, why: 'no-live-price' };
  const day = dayKeyFromQuote(quote);
  const num = (x, fb) => (Number.isFinite(x) ? x : fb);
  const last = bars[bars.length - 1];

  if (!last || String(last.date) < day) {
    bars.push({
      date: day,
      open: num(quote.open, price), close: price,
      high: num(quote.high, price), low: num(quote.low, price),
      volume: num(quote.volume, 0), amount: Number.isFinite(quote.amount) ? quote.amount : null
    });
    return { bars, merged: true, mode: 'appended', day };
  }
  if (String(last.date) === day) {
    /* 同日：用实时口径覆盖。日 K 接口自带 60s 缓存，而这里是每 8s 一次，
       覆盖之后布林与导轨才会跟着盘中价格走，而不是一分钟才动一下。 */
    bars[bars.length - 1] = {
      ...last,
      close: price,
      high: Math.max(num(quote.high, price), num(last.high, price), price),
      low: Math.min(num(quote.low, price), num(last.low, price), price),
      volume: num(quote.volume, 0) > 0 ? quote.volume : last.volume
    };
    return { bars, merged: true, mode: 'updated', day };
  }
  return { bars, merged: false, why: 'kline-newer-than-quote' };
}

/** 组装图表载荷：三条序列同源同长，偏移显式，数据不足时说明原因 */
function buildChartPayload(klineMerged, ind, minutes, quote) {
  const n = Math.min(CHART_BARS, klineMerged.length);
  const kApp = klineMerged.slice(-n);
  const at = (arr) => alignedTail(arr, n);

  const railSeries = ind.rails && ind.rails.series ? ind.rails.series : null;
  const railBars = railSeries && Array.isArray(railSeries.up) ? railSeries.up.length : 0;
  const railOffset = Math.max(0, n - railBars);

  /* 数据不足时给出结构化原因，渲染层据此画一句人话，而不是留一块白 */
  let degraded = null;
  if (n === 0) degraded = { reason: 'no-kline', bars: 0, text: '数据源未返回日K数据' };
  else if (n < 12) degraded = { reason: 'too-short', bars: n, text: `日K仅 ${n} 根，不足指标窗口（需 ≥12 根）` };

  return {
    bars: n,
    kline: kApp,
    dates: kApp.map((x) => x && x.date),
    macd: {
      dif: at(ind.macdSeries && ind.macdSeries.dif),
      dea: at(ind.macdSeries && ind.macdSeries.dea),
      hist: at(ind.macdSeries && ind.macdSeries.hist)
    },
    boll: ind.bollInfo && ind.bollInfo.series ? {
      up: at(ind.bollInfo.series.up),
      mid: at(ind.bollInfo.series.mid),
      dn: at(ind.bollInfo.series.dn)
    } : null,
    rails: railSeries && railBars ? {
      up: alignedTail(railSeries.up, railBars),
      mid: alignedTail(railSeries.mid, railBars),
      dn: alignedTail(railSeries.dn, railBars),
      bars: railBars,
      /* 显式偏移 + 日期锚点：客户端优先按日期对齐，日期缺失才退回用 offset。
         两者都在载荷里，是为了让「对齐」这件事可被断言，而不是靠推导。 */
      offset: railOffset,
      dates: Array.isArray(railSeries.dates) ? railSeries.dates.slice(-railBars) : []
    } : null,
    minutes: (minutes && minutes.ticks) || [],
    preClose: (minutes && minutes.preClose) || (quote && quote.preClose) || null,
    degraded
  };
}

/* --------------------------- 主分析流程 --------------------------- */
async function analyze(code, opts = {}) {
  const { code: c, market } = src.normalize(code);
  if (!market) throw new Error(`无法识别的股票代码：${code}`);

  const [quotes, klineRaw] = await Promise.all([
    src.getQuotes([c]),
    src.getKline(c, 'day', 300)
  ]);
  let quote = quotes[c];

  if (!quote) throw new Error(`未获取到 ${code} 的实时行情`);

  /* 先并入当日实时 bar，再算指标 —— 顺序反了，布林/导轨就会永远比行情晚一天 */
  const merged = mergeTodayBar(klineRaw, quote);
  const kline = merged.bars;

  const [flowResult, minResult] = await Promise.allSettled([
    src.getFundFlow(c),
    src.getMinutes(c)
  ]);
  const flow = flowResult.status === 'fulfilled' ? flowResult.value : null;
  const minutes = minResult.status === 'fulfilled' ? minResult.value : { ticks: [], preClose: quote.preClose };

  const ind = tech.computeIndicators(kline, quote);

  /* 画像：优先用导入的投研画像；没有则为该标的现场合成一份"自动画像"，
     让任意查询标的都能有完整的画像卡片与可触发的监控清单。
     自动画像带 auto:true 标记，UI/报告必须显著标注来源，不得冒充研报。 */
  const realProfile = getProfile(c);
  const isAuto = !realProfile;
  const profile = realProfile || portrait.synthesizeProfile({
    ind, quote, flow, minutes, code: c, market, name: quote.name
  });

  const ctx = { ind, quote, flow, profile, minutes };

  /* 监控清单求值：专项清单与通用清单共用同一套脚手架。
     专项清单信号归入画像面评分；自动画像的通用清单归入监控面评分（不混入画像面）。 */
  const monEval = monitors.evaluate(profile?.monitors || [], ctx, { origin: isAuto ? 'monitor' : 'profile' });

  const signals = [
    ...rules.technicalRules(ctx),
    ...rules.channelRules(ctx),
    ...rules.profileRules(ctx),
    ...monEval.signals
  ];

  const techScore = rules.scoreSignals(signals, (s) => s.origin === 'technical');
  const profileScore = signals.some((s) => s.origin === 'profile')
    ? rules.scoreSignals(signals, (s) => s.origin === 'profile') : null;
  const monitorScore = signals.some((s) => s.origin === 'monitor')
    ? rules.scoreSignals(signals, (s) => s.origin === 'monitor') : null;

  const quality = realProfile?.profileQuality || (realProfile ? 'high' : 'auto');
  /* 画像质量权重仅对"真正的投研画像"生效：high→0.45、low→0.75。
     自动画像（无投研画像）绝不走 profileScore 分支，统一使用 0.6/0.4 的监控面公式。
     旧写法的 `: 1`（纯技术）会在异常情况下把监控面分数静默吞掉，误导结论。 */
  const wTech = quality === 'low' ? 0.75 : 0.45;

  let composite;
  if (realProfile && profileScore != null) {
    composite = clamp(Math.round(techScore * wTech + profileScore * (1 - wTech)), 2, 98);
  } else if (monitorScore != null) {
    composite = clamp(Math.round(techScore * AUTO_W_TECH + monitorScore * (1 - AUTO_W_TECH)), 2, 98);
  } else {
    composite = techScore;
  }

  let action = decideAction({ composite, techScore, profileScore, ind, profile, signals });
  if (!profile?.cost) action = adaptForNoPosition(action);
  let plan = buildPlan(ind, profile, action.key);

  /* 盈亏比风控修正：目标空间不足以覆盖止损风险时，自动下调操作级别 */
  if (plan.riskReward != null && plan.riskReward < 1 && (action.key === 'BUY' || action.key === 'ADD')) {
    const prevLabel = action.label;
    const next = action.key === 'BUY' ? ACTIONS.ADD : ACTIONS.WATCH;
    action = {
      ...next,
      reasons: [...action.reasons,
        `【风控修正】当前盈亏比仅 ${plan.riskReward} : 1（目标空间 ${r2(((plan.target1 - ind.price) / ind.price) * 100)}% 不足以覆盖 ${plan.riskPct}% 的止损风险），`
        + `操作建议已由「${prevLabel}」自动下调为「${next.label}」，避免低赔率交易。`],
      confidence: Math.max(30, action.confidence - 18)
    };
    plan = buildPlan(ind, profile, action.key);
  }

  const bulls = signals.filter((s) => s.side === 'bull');
  const bears = signals.filter((s) => s.side === 'bear');
  const neutrals = signals.filter((s) => s.side === 'neutral');

  /* 监控清单：清单行本身（含每项状态）+ 求值产生的信号 + 概览 */
  const monitorRows = monEval.rows;
  const monitorSummary = monitors.summarize(monitorRows);
  const monitorsSource = isAuto ? 'auto' : 'profile';

  return {
    code: c, market, name: quote.name || profile?.name || c,
    quote: {
      ...quote,
      changePct: quote.changePct != null ? +quote.changePct.toFixed(2) : null,
      turnover: quote.turnover != null ? +quote.turnover.toFixed(2) : null,
      amount: quote.amount != null ? Math.round(quote.amount) : null
    },
    flow,
    ind: {
      price: ind.price, ma: ind.ma, macd: ind.macd, rsi: ind.rsi, kdj: ind.kdj,
      boll: { up: ind.boll.up, mid: ind.boll.mid, dn: ind.boll.dn },
      bollInfo: ind.bollInfo
        ? { bandwidthPct: ind.bollInfo.bandwidthPct, bandwidthPctile: ind.bollInfo.bandwidthPctile, pctB: ind.bollInfo.pctB, state: ind.bollInfo.state, stateLabel: ind.bollInfo.stateLabel }
        : null,
      rails: ind.rails ? {
        dir: ind.rails.dir, slope20Pct: ind.rails.slope20Pct, up: ind.rails.up, mid: ind.rails.mid,
        dn: ind.rails.dn, pctChan: ind.rails.pctChan, widthPct: ind.rails.widthPct, bars: ind.rails.bars,
        nearUpper: ind.rails.nearUpper, nearLower: ind.rails.nearLower, reliable: ind.rails.reliable, k: ind.rails.k
      } : null,
      donchian: ind.donchian,
      channelVerdict: ind.channelVerdict,
      atr: ind.atr, atrPct: ind.atrPct, position52: ind.position52, high52: ind.high52, low52: ind.low52,
      high20: ind.high20, low20: ind.low20, returns: ind.returns, maArrangement: ind.maArrangement,
      keyLevels: ind.keyLevels
    },
    chart: buildChartPayload(kline, ind, minutes, quote),
    /* 图表自检：每层「有没有数据、几个点、对齐锚点是什么」都在这里，
       前端诊断面板直接展开它。下次再遇到「图像为空」，看一眼就知道是
       数据源没给、还是窗口不够、还是对齐没对上 —— 不用再去猜画布。 */
    chartInfo: {
      barCount: kline.length,
      todayBar: merged.merged ? { mode: merged.mode, day: merged.day } : { mode: 'not-merged', why: merged.why },
      bollPoints: ind.bollInfo && ind.bollInfo.series ? ind.bollInfo.series.up.length : 0,
      railBars: ind.rails && ind.rails.series ? ind.rails.series.up.length : 0,
      railReliable: !!(ind.rails && ind.rails.reliable),
      minuteTicks: (minutes.ticks || []).length
    },
    monitors: monitorRows,
    monitorsSource,
    monitorSummary,
    profile: profile ? {
      name: profile.name, tags: profile.tags, thesis: profile.thesis, moat: profile.moat,
      valuation: profile.valuation, levels: profile.levels, cost: profile.cost,
      takeProfit: profile.takeProfit || [], catalysts: profile.catalysts,
      businessMix: profile.businessMix, monitors: profile.monitors,
      fundamentals: profile.fundamentals, chips: profile.chips, risks: profile.risks,
      verdictNote: profile.verdictNote, sourceDoc: profile.sourceDoc, reportDate: profile.reportDate,
      profileQuality: quality,
      /* 自动画像的诚信标记：UI/报告据此标注来源，不得展示为投研结论 */
      auto: !!profile.auto,
      disclaimer: profile.disclaimer || null
    } : null,
    signals: {
      all: signals.sort((a, b) => b.strength * b.weight - a.strength * a.weight),
      bull: bulls, bear: bears, neutral: neutrals
    },
    scores: { composite, technical: techScore, profile: profileScore, monitor: monitorScore },
    action,
    plan,
    generatedAt: new Date().toISOString()
  };
}

module.exports = { analyze, getProfile, ACTIONS, profilesData };
