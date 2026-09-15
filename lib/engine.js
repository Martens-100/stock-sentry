'use strict';
/**
 * 分析引擎：把行情、指标、信号、画像合成为「入场/离场」明确结论
 */
const src = require('./source');
const tech = require('./tech');
const rules = require('./rules');
const profilesData = require('../data/profiles.json');

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const r2 = (x) => (Number.isFinite(x) ? +x.toFixed(2) : null);

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
  const L = profile?.levels || {};
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
  const L = profile?.levels || {};
  const atr = ind.atr || P * 0.02;

  const supports = (ind.keyLevels || []).filter((k) => k.side === 'support')
    .sort((a, b) => b.price - a.price).slice(0, 5);
  const resistances = (ind.keyLevels || []).filter((k) => k.side === 'resistance')
    .sort((a, b) => a.price - b.price).slice(0, 5);

  // 兜底：以均线补齐支撑/阻力参考位
  const maRef = [
    { name: 'MA5', v: ind.ma.ma5 }, { name: 'MA10', v: ind.ma.ma10 }, { name: 'MA20', v: ind.ma.ma20 },
    { name: 'MA30', v: ind.ma.ma30 }, { name: 'MA60', v: ind.ma.ma60 }, { name: 'MA120', v: ind.ma.ma120 },
    { name: 'MA250', v: ind.ma.ma250 }
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

  const entryLo = L.entry?.[0] ?? r2(P - atr * 1.5);
  const entryHi = L.entry?.[1] ?? r2(P - atr * 0.5);
  const stopLoss = L.stopLoss ?? r2(P - atr * 2.5);
  const hardStop = L.hardStop ?? r2(P - atr * 3.5);
  // 自动推导目标位时，要求与现价保持足够距离（≥1.2×ATR），避免目标位"贴脸"导致盈亏比失真
  const minTgtDist = atr * 1.2;
  const farRes = resistances.filter((r) => r.price >= P + minTgtDist);
  const target1 = L.target1 ?? (farRes[0]?.price ?? r2(P + atr * 4));
  let target2 = L.target2 ?? (farRes.filter((r) => r.price > target1)[0]?.price ?? r2(P + atr * 7));
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
    fromProfile: !!(L.entry || L.stopLoss),
    canEnter: batchKind !== 'exit',
    batches: batchKind === 'exit' ? exitBatches : batches,
    batchKind
  };
}

/* --------------------------- 主分析流程 --------------------------- */
async function analyze(code, opts = {}) {
  const { code: c, market } = src.normalize(code);
  if (!market) throw new Error(`无法识别的股票代码：${code}`);

  const [quotes, kline] = await Promise.all([
    src.getQuotes([c]),
    src.getKline(c, 'day', 300)
  ]);
  let quote = quotes[c];

  if (!quote) throw new Error(`未获取到 ${code} 的实时行情`);

  const [flowResult, minResult] = await Promise.allSettled([
    src.getFundFlow(c),
    src.getMinutes(c)
  ]);
  const flow = flowResult.status === 'fulfilled' ? flowResult.value : null;
  const minutes = minResult.status === 'fulfilled' ? minResult.value : { ticks: [], preClose: quote.preClose };

  const ind = tech.computeIndicators(kline, quote);
  const profile = getProfile(c);

  const ctx = { ind, quote, flow, profile, minutes };
  const signals = [
    ...rules.technicalRules(ctx),
    ...rules.channelRules(ctx),
    ...rules.profileRules(ctx)
  ];

  const techScore = rules.scoreSignals(signals, (s) => s.origin === 'technical');
  const pfSignals = signals.filter((s) => s.origin === 'profile');
  const profileScore = pfSignals.length ? rules.scoreSignals(signals, (s) => s.origin === 'profile') : null;

  const quality = profile?.profileQuality || (profile ? 'high' : 'none');
  const wTech = quality === 'high' ? 0.45 : quality === 'low' ? 0.75 : 1;
  const composite = profileScore != null
    ? clamp(Math.round(techScore * wTech + profileScore * (1 - wTech)), 2, 98)
    : techScore;

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
    chart: {
      kline: kline.slice(-120),
      macd: ind.macdSeries,
      boll: ind.bollInfo ? {
        up: ind.bollInfo.series.up.slice(-120),
        mid: ind.bollInfo.series.mid.slice(-120),
        dn: ind.bollInfo.series.dn.slice(-120)
      } : null,
      rails: ind.rails ? {
        up: ind.rails.series.up,
        mid: ind.rails.series.mid,
        dn: ind.rails.series.dn,
        bars: ind.rails.bars
      } : null,
      minutes: minutes.ticks || [],
      preClose: minutes.preClose || quote.preClose
    },
    profile: profile ? {
      name: profile.name, tags: profile.tags, thesis: profile.thesis, moat: profile.moat,
      valuation: profile.valuation, levels: profile.levels, cost: profile.cost,
      takeProfit: profile.takeProfit || [], catalysts: profile.catalysts,
      businessMix: profile.businessMix, monitors: profile.monitors,
      fundamentals: profile.fundamentals, chips: profile.chips, risks: profile.risks,
      verdictNote: profile.verdictNote, sourceDoc: profile.sourceDoc, reportDate: profile.reportDate,
      profileQuality: quality
    } : null,
    signals: {
      all: signals.sort((a, b) => b.strength * b.weight - a.strength * a.weight),
      bull: bulls, bear: bears, neutral: neutrals
    },
    scores: { composite, technical: techScore, profile: profileScore },
    action,
    plan,
    generatedAt: new Date().toISOString()
  };
}

module.exports = { analyze, getProfile, ACTIONS, profilesData };
