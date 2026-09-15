'use strict';
/**
 * 信号规则引擎
 * 两类规则：
 *  A. 通用技术规则 —— 适用于任意标的，由实时行情 + K线推导
 *  B. 个股画像规则 —— 从投研文档提取的关键价位/估值/监控清单
 * 每条信号输出：方向 / 强度 / 权重 / 结论文本 / 数据依据
 */

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const pct = (x) => (x == null ? '—' : `${x > 0 ? '+' : ''}${x}%`);

/* ================================================================== */
/* A. 通用技术规则                                                     */
/* ================================================================== */
function technicalRules(ctx) {
  const { ind, quote, flow } = ctx;
  const s = [];
  const P = ind.price;
  const push = (o) => s.push({ ...o, origin: 'technical' });

  /* --- 1. 均线趋势排列 --- */
  const arr = ind.maArrangement;
  if (arr === 'bull') {
    push({ id: 'ma-bull', dim: '趋势结构', name: '均线多头排列', side: 'bull', strength: 5, weight: 10,
      text: 'MA5>MA10>MA20>MA60 多头排列，中期趋势向上',
      evidence: `MA5 ${ind.ma.ma5} / MA10 ${ind.ma.ma10} / MA20 ${ind.ma.ma20} / MA60 ${ind.ma.ma60}` });
  } else if (arr === 'bear') {
    push({ id: 'ma-bear', dim: '趋势结构', name: '均线空头排列', side: 'bear', strength: 5, weight: 10,
      text: 'MA5<MA10<MA20<MA60 空头排列，中期趋势向下',
      evidence: `MA5 ${ind.ma.ma5} / MA10 ${ind.ma.ma10} / MA20 ${ind.ma.ma20} / MA60 ${ind.ma.ma60}` });
  } else {
    push({ id: 'ma-mixed', dim: '趋势结构', name: '均线纠缠', side: 'neutral', strength: 2, weight: 6,
      text: '均线交错，趋势方向不明，处于震荡整理阶段',
      evidence: `MA5 ${ind.ma.ma5} / MA20 ${ind.ma.ma20} / MA60 ${ind.ma.ma60}` });
  }

  /* --- 2. 价格相对 MA20 / MA60 --- */
  if (ind.ma.ma20 != null) {
    const d = ((P - ind.ma.ma20) / ind.ma.ma20) * 100;
    push({
      id: 'px-ma20', dim: '趋势结构', name: d >= 0 ? '站上20日线' : '跌破20日线',
      side: d >= 0 ? 'bull' : 'bear', strength: clamp(Math.round(Math.abs(d) / 2) + 2, 2, 4), weight: 8,
      text: d >= 0 ? `价格位于20日均线上方，中期成本支撑有效` : `价格位于20日均线下方，中期成本压制`,
      evidence: `现价 ${P} vs MA20 ${ind.ma.ma20}（偏离 ${d.toFixed(2)}%）`
    });
  }
  if (ind.ma.ma60 != null) {
    const d = ((P - ind.ma.ma60) / ind.ma.ma60) * 100;
    push({
      id: 'px-ma60', dim: '趋势结构', name: d >= 0 ? '位于季线上方' : '位于季线下方',
      side: d >= 0 ? 'bull' : 'bear', strength: clamp(Math.round(Math.abs(d) / 4) + 1, 1, 3), weight: 6,
      text: d >= 0 ? '季线之上，长线资金成本占优' : '季线之下，长线趋势偏弱',
      evidence: `现价 ${P} vs MA60 ${ind.ma.ma60}（偏离 ${d.toFixed(2)}%）`
    });
  }

  /* --- 3. MACD --- */
  const md = ind.macd;
  if (md.dif != null && md.dea != null) {
    const golden = md.dif > md.dea;
    const crossUp = md.dif > md.dea && md.hist > 0 && md.prevHist <= 0;
    const crossDn = md.dif < md.dea && md.hist < 0 && md.prevHist >= 0;
    if (crossUp) push({ id: 'macd-gold', dim: '动量指标', name: 'MACD金叉', side: 'bull', strength: 4, weight: 9,
      text: 'MACD 于零轴附近金叉，动量由弱转强', evidence: `DIF ${md.dif} 上穿 DEA ${md.dea}，柱 ${md.hist}` });
    else if (crossDn) push({ id: 'macd-dead', dim: '动量指标', name: 'MACD死叉', side: 'bear', strength: 4, weight: 9,
      text: 'MACD 死叉，动量转弱', evidence: `DIF ${md.dif} 下穿 DEA ${md.dea}，柱 ${md.hist}` });
    else push({
      id: 'macd-state', dim: '动量指标', name: golden ? 'MACD多头区' : 'MACD空头区',
      side: golden ? 'bull' : 'bear', strength: md.dif > 0 && md.dea > 0 ? 4 : 2, weight: 8,
      text: golden
        ? (md.dif > 0 ? 'MACD 零轴上方多头区，趋势动能健康' : 'MACD 零轴下方金叉后修复，动能边际改善')
        : (md.dif < 0 ? 'MACD 零轴下方空头区，动能疲弱' : 'MACD 高位死叉，动能衰竭'),
      evidence: `DIF ${md.dif} / DEA ${md.dea} / 柱 ${md.hist}`
    });
  }

  /* --- 4. RSI --- */
  if (ind.rsi != null) {
    if (ind.rsi >= 75) push({ id: 'rsi-ob', dim: '超买超卖', name: 'RSI超买', side: 'bear', strength: 3, weight: 6,
      text: 'RSI 进入超买区，短线追高风险上升', evidence: `RSI(14)=${ind.rsi}` });
    else if (ind.rsi <= 28) push({ id: 'rsi-os', dim: '超买超卖', name: 'RSI超卖', side: 'bull', strength: 3, weight: 6,
      text: 'RSI 进入超卖区，存在超跌反弹动能', evidence: `RSI(14)=${ind.rsi}` });
    else if (ind.rsi >= 55) push({ id: 'rsi-strong', dim: '超买超卖', name: 'RSI偏强', side: 'bull', strength: 2, weight: 5,
      text: 'RSI 位于强势区，多方掌握主动', evidence: `RSI(14)=${ind.rsi}` });
    else if (ind.rsi <= 45) push({ id: 'rsi-weak', dim: '超买超卖', name: 'RSI偏弱', side: 'bear', strength: 2, weight: 5,
      text: 'RSI 位于弱势区，多方动能不足', evidence: `RSI(14)=${ind.rsi}` });
  }

  /* --- 5. KDJ --- */
  const kd = ind.kdj;
  if (kd.k != null && kd.d != null) {
    const crossUp = kd.prevK != null && kd.prevK <= kd.prevD && kd.k > kd.d;
    const crossDn = kd.prevK != null && kd.prevK >= kd.prevD && kd.k < kd.d;
    if (crossUp) push({ id: 'kdj-gold', dim: '动量指标', name: 'KDJ金叉', side: 'bull', strength: 3, weight: 5,
      text: 'KDJ 低位金叉，短线有反抽要求', evidence: `K ${kd.k} 上穿 D ${kd.d}，J=${kd.j}` });
    else if (crossDn) push({ id: 'kdj-dead', dim: '动量指标', name: 'KDJ死叉', side: 'bear', strength: 3, weight: 5,
      text: 'KDJ 死叉，短线调整压力', evidence: `K ${kd.k} 下穿 D ${kd.d}，J=${kd.j}` });
    if (kd.j != null && kd.j > 100) push({ id: 'kdj-j-high', dim: '超买超卖', name: 'J值极值', side: 'bear', strength: 2, weight: 4,
      text: 'J 值超过 100，短线过热', evidence: `J=${kd.j}` });
    if (kd.j != null && kd.j < 0) push({ id: 'kdj-j-low', dim: '超买超卖', name: 'J值归零', side: 'bull', strength: 2, weight: 4,
      text: 'J 值低于 0，短线严重超跌', evidence: `J=${kd.j}` });
  }

  /* --- 6. BOLL 位置（详细上下轨判定见 channelRules） --- */

  /* --- 7. 量价关系 --- */
  const vr = quote?.volumeRatio ?? ind.volRatioLocal;
  const chg = quote?.changePct ?? 0;
  if (vr != null) {
    if (vr >= 1.8 && chg > 1) push({ id: 'vol-up', dim: '量价关系', name: '放量上涨', side: 'bull', strength: 4, weight: 8,
      text: '成交量显著放大且价格上行，资金主动进场', evidence: `量比 ${vr}，涨幅 ${pct(chg)}` });
    else if (vr >= 1.8 && chg < -1) push({ id: 'vol-dn', dim: '量价关系', name: '放量下跌', side: 'bear', strength: 5, weight: 9,
      text: '放量下跌，抛压沉重，警惕资金出逃', evidence: `量比 ${vr}，跌幅 ${pct(chg)}` });
    else if (vr <= 0.7 && chg > 0) push({ id: 'vol-shrink-up', dim: '量价关系', name: '缩量上涨', side: 'neutral', strength: 2, weight: 5,
      text: '缩量上涨，上攻动能不足，需警惕无量反弹', evidence: `量比 ${vr}，涨幅 ${pct(chg)}` });
    else if (vr <= 0.7 && chg < 0) push({ id: 'vol-shrink-dn', dim: '量价关系', name: '缩量下跌', side: 'neutral', strength: 2, weight: 4,
      text: '缩量下跌，抛压有限，多为存量博弈', evidence: `量比 ${vr}，跌幅 ${pct(chg)}` });
    else push({ id: 'vol-normal', dim: '量价关系', name: '量能平稳', side: 'neutral', strength: 1, weight: 3,
      text: '成交活跃度平稳，无明显资金异动', evidence: `量比 ${vr}` });
  }

  /* --- 8. 突破 / 破位 --- */
  if (ind.high20 != null && P > ind.high20) {
    push({ id: 'break-high', dim: '关键突破', name: '突破20日新高', side: 'bull', strength: 4, weight: 9,
      text: '向上突破近20个交易日高点，打开上行空间', evidence: `现价 ${P} > 20日高点 ${ind.high20}` });
  }
  if (ind.low20 != null && P < ind.low20) {
    push({ id: 'break-low', dim: '关键突破', name: '跌破20日新低', side: 'bear', strength: 4, weight: 9,
      text: '向下跌破近20个交易日低点，技术形态走坏', evidence: `现价 ${P} < 20日低点 ${ind.low20}` });
  }

  /* --- 9. 52周位置 --- */
  if (ind.position52 != null) {
    if (ind.position52 <= 15) push({ id: 'pos-low', dim: '价格位置', name: '接近年内低位', side: 'bull', strength: 3, weight: 7,
      text: '处于52周区间底部，向下空间相对有限', evidence: `位置分位 ${ind.position52}%（年内 ${ind.low52}~${ind.high52}）` });
    else if (ind.position52 >= 85) push({ id: 'pos-high', dim: '价格位置', name: '接近年内高位', side: 'bear', strength: 3, weight: 7,
      text: '处于52周区间高位，追高性价比下降', evidence: `位置分位 ${ind.position52}%（年内 ${ind.low52}~${ind.high52}）` });
    else push({ id: 'pos-mid', dim: '价格位置', name: '区间中位', side: 'neutral', strength: 1, weight: 4,
      text: '处于52周区间中段，方向待选择', evidence: `位置分位 ${ind.position52}%` });
  }

  /* --- 10. 资金流 --- */
  if (flow?.today) {
    const main = flow.today.main;
    const unit = flow.source === 'eastmoney' ? '元' : '元(估)';
    const amt = quote?.amount || null;
    const ratio = amt ? +((main / amt) * 100).toFixed(2) : null;
    if (main > 0) push({ id: 'flow-in', dim: '资金流向', name: '主力资金净流入', side: 'bull',
      strength: ratio != null && ratio > 5 ? 4 : 3, weight: 8,
      text: '当日主力资金净流入，承接盘积极',
      evidence: `净流入 ${(main / 10000).toFixed(0)}万元${ratio != null ? `（占成交额 ${ratio}%）` : ''}｜口径：${flow.source === 'eastmoney' ? '东方财富主力单' : '分时主动买卖估算'}` });
    else if (main < 0) push({ id: 'flow-out', dim: '资金流向', name: '主力资金净流出', side: 'bear',
      strength: ratio != null && ratio < -5 ? 4 : 3, weight: 8,
      text: '当日主力资金净流出，抛压占优',
      evidence: `净流出 ${(Math.abs(main) / 10000).toFixed(0)}万元${ratio != null ? `（占成交额 ${ratio}%）` : ''}｜口径：${flow.source === 'eastmoney' ? '东方财富主力单' : '分时主动买卖估算'}` });
  }

  /* --- 11. 内外盘 --- */
  if (quote?.outer != null && quote?.inner != null && (quote.outer + quote.inner) > 0) {
    const r = quote.outer / (quote.outer + quote.inner);
    push({
      id: 'inner-outer', dim: '盘中博弈', name: r > 0.55 ? '外盘占优' : r < 0.45 ? '内盘占优' : '内外盘均衡',
      side: r > 0.55 ? 'bull' : r < 0.45 ? 'bear' : 'neutral',
      strength: Math.abs(r - 0.5) > 0.12 ? 3 : 2, weight: 5,
      text: r > 0.55 ? '外盘（主动买）占比高，买盘意愿强' : r < 0.45 ? '内盘（主动卖）占比高，卖盘意愿强' : '内外盘均衡，多空分歧不大',
      evidence: `外盘 ${quote.outer} 手 / 内盘 ${quote.inner} 手（外盘占比 ${(r * 100).toFixed(1)}%）`
    });
  }

  /* --- 12. 近期涨跌幅 --- */
  const r5 = ind.returns.d5, r20 = ind.returns.d20;
  if (r5 != null && r5 <= -8) push({ id: 'drop5', dim: '短线异动', name: '5日急跌', side: 'bull', strength: 2, weight: 5,
    text: '5个交易日累计跌幅较大，短线存在修复需求', evidence: `5日 ${pct(r5)}（20日 ${pct(r20)}）` });
  if (r5 != null && r5 >= 15) push({ id: 'rise5', dim: '短线异动', name: '5日急涨', side: 'bear', strength: 2, weight: 5,
    text: '5个交易日累计涨幅较大，短线获利盘丰厚', evidence: `5日 ${pct(r5)}（20日 ${pct(r20)}）` });

  return s;
}

/* ================================================================== */
/* A2. 上下轨线与导轨区间规则                                          */
/* ================================================================== */
function channelRules(ctx) {
  const { ind } = ctx;
  const s = [];
  const P = ind.price;
  const push = (o) => s.push({ ...o, origin: 'technical' });
  const bi = ind.bollInfo;
  const ra = ind.rails;
  const dc = ind.donchian;

  /* ---------- 1. 布林带三条轨道 ---------- */
  if (bi && bi.series.up[ind.series.closes.length - 1] != null) {
    const B = { up: ind.boll.up, mid: ind.boll.mid, dn: ind.boll.dn };
    const pos = bi.pctB;
    const slopeUp = ra?.dir === 'up';
    const slopeDown = ra?.dir === 'down';

    if (pos >= 1) {
      push({
        id: 'band-above-up', dim: '上下轨线', name: '站上布林上轨', side: 'bull', strength: slopeDown ? 2 : 4, weight: 8,
        text: slopeDown ? '价格冲击布林上轨但导轨仍向下，属下跌通道中的反抽，持续性存疑' : '价格站上布林上轨，进入强势轨道（沿上轨运行）；但偏离均值过大，追高需等回踩中轨',
        evidence: `现价 ${P} ／ 上轨 ${B.up} ／ 中轨 ${B.mid}（%B=${(pos * 100).toFixed(0)}%）`
      });
      push({ id: 'band-overheat', dim: '上下轨线', name: '轨道过热提示', side: 'bear', strength: 2, weight: 6,
        text: '上轨之上属统计意义上的高波动区，短线获利盘与均值回归压力同步上升',
        evidence: `%B=${(pos * 100).toFixed(0)}%（>100% 表示已突破上轨）` });
    } else if (pos >= 0.8) {
      push({ id: 'band-near-up', dim: '上下轨线', name: '逼近布林上轨', side: 'bull', strength: 3, weight: 7,
        text: '价格逼近布林上轨，多头轨道保持完好，但上方空间收窄',
        evidence: `现价 ${P} ／ 上轨 ${B.up}（%B=${(pos * 100).toFixed(0)}%）` });
    } else if (pos <= 0) {
      if (slopeDown) {
        push({ id: 'band-below-dn', dim: '上下轨线', name: '跌破布林下轨（弱势延续）', side: 'bear', strength: 5, weight: 9,
          text: '价格跌破布林下轨且回归导轨方向向下，属下跌通道中的加速段，不宜盲目抄底',
          evidence: `现价 ${P} ／ 下轨 ${B.dn}｜导轨斜率 ${ra.slope20Pct}%/20日（${ra.dir}）` });
      } else {
        push({ id: 'band-below-dn', dim: '上下轨线', name: '跌破布林下轨（超跌）', side: 'bull', strength: 3, weight: 8,
          text: '价格跌破布林下轨但导轨未转弱，属统计意义上的超跌区，均值回归概率提升',
          evidence: `现价 ${P} ／ 下轨 ${B.dn}｜导轨斜率 ${ra.slope20Pct}%/20日（${ra.dir}）` });
      }
    } else if (pos <= 0.2) {
      push({ id: 'band-near-dn', dim: '上下轨线', name: '逼近布林下轨', side: 'bear', strength: 3, weight: 7,
        text: '价格逼近布林下轨，弱势轨道尚未修复，等待中轨收复再谈反转',
        evidence: `现价 ${P} ／ 下轨 ${B.dn}（%B=${(pos * 100).toFixed(0)}%）` });
    } else {
      push({
        id: 'band-mid', dim: '上下轨线', name: pos >= 0.5 ? '运行于中轨上方' : '运行于中轨下方',
        side: pos >= 0.5 ? 'bull' : 'bear', strength: 2, weight: 6,
        text: pos >= 0.5 ? '价格位于布林中轨之上，多头轨道内运行' : '价格位于布林中轨之下，空头轨道内运行',
        evidence: `%B=${(pos * 100).toFixed(0)}%｜下轨 ${B.dn} ／ 中轨 ${B.mid} ／ 上轨 ${B.up}`
      });
    }

    /* ---------- 2. 带宽状态：收口 / 开口 ---------- */
    if (bi.state === 'squeeze') {
      push({ id: 'band-squeeze', dim: '上下轨线', name: '布林带收口', side: 'neutral', strength: 3, weight: 8,
        text: `布林带带宽处于近120日 ${bi.bandwidthPctile}% 分位（收口），波动被压缩至极致，往往预示变盘临近——方向未定前不宜重仓押注`,
        evidence: `带宽 ${bi.bandwidthPct}%（历史分位 ${bi.bandwidthPctile}%）；参考：向上突破上轨 ${ind.boll.up} / 向下跌破下轨 ${ind.boll.dn}` });
    } else if (bi.state === 'expand') {
      const upMove = ind.returns.d5 != null ? ind.returns.d5 >= 0 : true;
      push({ id: 'band-expand', dim: '上下轨线', name: '布林带开口', side: upMove ? 'bull' : 'bear', strength: 3, weight: 7,
        text: upMove ? '布林带开口放大且价格上行，趋势进入加速段' : '布林带开口放大且价格走低，下跌动能释放',
        evidence: `带宽 ${bi.bandwidthPct}%（历史分位 ${bi.bandwidthPctile}%）｜5日涨跌 ${ind.returns.d5 ?? '—'}%` });
    }
  }

  /* ---------- 3. 回归导轨通道 ---------- */
  if (ra && !ra.reliable) {
    push({ id: 'rail-unreliable', dim: '导轨区间', name: '导轨宽度过大（参考性弱）', side: 'neutral', strength: 1, weight: 4,
      text: `近${ra.bars}日回归通道宽度达价格的 ${ra.widthPct}%，波动结构分散，导轨方向判定的置信度较低，建议以布林带与唐奇安区间为主`,
      evidence: `通道 ${ra.dn} ~ ${ra.up}（宽度 ${ra.widthPct}%，k=${ra.k}）` });
  } else if (ra) {
    const dirTxt = ra.dir === 'up' ? '上升' : ra.dir === 'down' ? '下降' : '水平';
    if (ra.dir === 'up') {
      push({ id: 'rail-dir-up', dim: '导轨区间', name: '上升导轨通道', side: 'bull', strength: 4, weight: 9,
        text: `近${ra.bars}日线性回归导轨方向向上（20日预计位移 ${ra.slope20Pct}%），价格运行于上升通道中，回踩下轨为低吸机会`,
        evidence: `导轨 上轨 ${ra.up} ／ 中轨 ${ra.mid} ／ 下轨 ${ra.dn}；通道宽度 ${ra.widthPct}%` });
    } else if (ra.dir === 'down') {
      push({ id: 'rail-dir-down', dim: '导轨区间', name: '下降导轨通道', side: 'bear', strength: 4, weight: 9,
        text: `近${ra.bars}日线性回归导轨方向向下（20日预计位移 ${ra.slope20Pct}%），反弹至中轨/上轨即为减仓窗口`,
        evidence: `导轨 上轨 ${ra.up} ／ 中轨 ${ra.mid} ／ 下轨 ${ra.dn}；通道宽度 ${ra.widthPct}%` });
    } else {
      push({ id: 'rail-flat', dim: '导轨区间', name: '水平导轨（箱体震荡）', side: 'neutral', strength: 2, weight: 7,
        text: '导轨近似水平，价格在箱体内往复，宜在箱底承接、箱顶减持，不宜追突破',
        evidence: `箱体 ${ra.dn} ~ ${ra.up}（宽度 ${ra.widthPct}%），当前位置 ${(ra.pctChan * 100).toFixed(0)}%` });
    }

    // 通道内位置
    if (ra.pctChan > 1.0) {
      push({ id: 'rail-breach-up', dim: '导轨区间', name: '突破导轨上轨', side: ra.dir === 'up' ? 'bull' : 'bear',
        strength: ra.dir === 'up' ? 3 : 4, weight: 8,
        text: ra.dir === 'up' ? '价格向上突破回归通道上轨，趋势强于统计常态' : '价格上破导轨上轨但通道向下，多属超买反抽，回归压力大',
        evidence: `现价 ${P} ／ 导轨上轨 ${ra.up}（通道位置 ${(ra.pctChan * 100).toFixed(0)}%）` });
    } else if (ra.pctChan < 0) {
      push({ id: 'rail-breach-dn', dim: '导轨区间', name: '跌破导轨下轨', side: 'bear', strength: 4, weight: 8,
        text: '价格向下跌破回归通道下轨，波动超出统计常态，需警惕趋势破位',
        evidence: `现价 ${P} ／ 导轨下轨 ${ra.dn}（通道位置 ${(ra.pctChan * 100).toFixed(0)}%）` });
    }

    // 沿轨运行
    if (ra.nearUpper >= 6) {
      push({ id: 'rail-hug-up', dim: '导轨区间', name: '沿导轨上轨运行', side: 'bull', strength: 3, weight: 7,
        text: '近10个交易日多数收盘价贴近通道上沿，属强势沿轨运行，可持有但须上移止盈',
        evidence: `近10日有 ${ra.nearUpper} 日收盘位于通道上沿 18% 区间内` });
    }
    if (ra.nearLower >= 6) {
      push({ id: 'rail-hug-dn', dim: '导轨区间', name: '沿导轨下轨运行', side: 'bear', strength: 3, weight: 7,
        text: '近10个交易日多数收盘价贴近通道下沿，属弱势沿轨下跌，反弹力度有限',
        evidence: `近10日有 ${ra.nearLower} 日收盘位于通道下沿 18% 区间内` });
    }
  }

  /* ---------- 4. 唐奇安区间导轨（20日高低） ---------- */
  if (dc) {
    if (P >= dc.upper) {
      push({ id: 'dc-break-up', dim: '导轨区间', name: '突破20日区间上沿', side: 'bull', strength: 4, weight: 9,
        text: '收盘价突破近20个交易日唐奇安通道上沿，区间突破形态成立',
        evidence: `现价 ${P} ≥ 区间上沿 ${dc.upper}（区间 ${dc.lower}~${dc.upper}）` });
    } else if (P <= dc.lower) {
      push({ id: 'dc-break-dn', dim: '导轨区间', name: '跌破20日区间下沿', side: 'bear', strength: 5, weight: 10,
        text: '收盘价跌破近20个交易日唐奇安通道下沿，区间破位，短线风险快速上升',
        evidence: `现价 ${P} ≤ 区间下沿 ${dc.lower}（区间 ${dc.lower}~${dc.upper}）` });
    } else {
      push({ id: 'dc-pos', dim: '导轨区间', name: '区间内运行', side: 'neutral', strength: 2, weight: 5,
        text: `价格处于20日区间导轨的 ${dc.pct}% 位置，${dc.pct > 70 ? '靠近上沿，追高性价比低' : dc.pct < 30 ? '靠近下沿，具备区间低吸条件' : '位于区间中部，方向待选择'}`,
        evidence: `区间 ${dc.lower} ~ ${dc.upper}（宽度 ${(dc.upper - dc.lower).toFixed(2)} 元）` });
    }
  }

  return s;
}

/* ================================================================== */
/* B. 个股画像规则                                                     */
/* ================================================================== */
function profileRules(ctx) {
  const { profile, ind, quote } = ctx;
  const s = [];
  if (!profile) return s;
  const push = (o) => s.push({ ...o, origin: 'profile' });
  const P = ind.price;
  const L = profile.levels || {};

  /* --- 关键价位判定 --- */
  if (L.entry && L.entry.length === 2) {
    const [lo, hi] = L.entry;
    if (P <= hi && P >= lo * 0.97) {
      push({ id: 'pf-entry-zone', dim: '持仓策略', name: '进入建仓区间', side: 'bull', strength: 5, weight: 10,
        text: `现价落入报告给定的建仓区间 ${lo}-${hi} 元，具备左侧布局条件`,
        evidence: `现价 ${P}，建仓区间 ${lo}~${hi}（依据：${profile.sourceDoc}）` });
    } else if (P < lo * 0.97) {
      push({ id: 'pf-below-entry', dim: '持仓策略', name: '低于建仓区间下沿', side: 'neutral', strength: 3, weight: 8,
        text: `现价已低于报告建仓区间下沿 ${lo} 元，或意味着基本面/预期发生变化，需重新评估而非机械抄底`,
        evidence: `现价 ${P} < 建仓下沿 ${lo}` });
    }
  }
  if (L.stopLoss && P <= L.stopLoss * 1.02) {
    push({ id: 'pf-stop', dim: '风控纪律', name: P <= L.stopLoss ? '已触及止损位' : '逼近止损位',
      side: 'bear', strength: P <= L.stopLoss ? 5 : 4, weight: 10,
      text: P <= L.stopLoss ? `价格已跌破报告设定的止损位 ${L.stopLoss} 元，按纪律应执行减仓/离场` : `价格逼近止损位 ${L.stopLoss} 元，需提前制定应对预案`,
      evidence: `现价 ${P} / 止损位 ${L.stopLoss}（依据：${profile.sourceDoc}）` });
  }
  if (L.target1 && P >= L.target1 * 0.98) {
    const hit2 = L.target2 && P >= L.target2 * 0.98;
    push({ id: 'pf-target', dim: '持仓策略', name: hit2 ? '触及第二目标位' : '触及第一目标位', side: 'bear', strength: hit2 ? 3 : 2, weight: 8,
      text: hit2 ? `已达第二目标位 ${L.target2} 元，建议分批兑现、保留底仓` : `接近第一目标位 ${L.target1} 元，若量能萎缩建议减仓 1/3`,
      evidence: `现价 ${P} / 目标位 ${L.target1}${L.target2 ? ` / ${L.target2}` : ''}` });
  }
  if (L.hardStop && P <= L.hardStop * 1.02) {
    push({ id: 'pf-hardstop', dim: '风控纪律', name: '触及硬止损', side: 'bear', strength: 5, weight: 10,
      text: `价格靠近硬止损位 ${L.hardStop} 元，跌破应无条件清仓`,
      evidence: `现价 ${P} / 硬止损 ${L.hardStop}` });
  }
  // 距离止盈/止损的空间
  if (L.target1 && P < L.target1) {
    push({ id: 'pf-space-up', dim: '盈亏空间', name: '上方目标空间', side: 'neutral', strength: 2, weight: 5,
      text: `距第一目标位 ${L.target1} 元尚有 ${(((L.target1 - P) / P) * 100).toFixed(1)}% 空间`,
      evidence: `现价 ${P} → 目标 ${L.target1}` });
  }
  if (L.stopLoss && P > L.stopLoss) {
    push({ id: 'pf-space-dn', dim: '盈亏空间', name: '下方风险空间', side: 'neutral', strength: 2, weight: 5,
      text: `距止损位 ${L.stopLoss} 元回撤空间 ${(((P - L.stopLoss) / P) * 100).toFixed(1)}%`,
      evidence: `现价 ${P} → 止损 ${L.stopLoss}` });
  }

  /* --- 持仓账户视角 --- */
  if (profile.cost) {
    const fl = ((P - profile.cost) / profile.cost) * 100;
    push({
      id: 'pf-cost', dim: '持仓账户', name: fl >= 0 ? '当前浮盈' : '当前浮亏',
      side: fl >= 0 ? 'bull' : 'bear', strength: Math.abs(fl) > 10 ? 3 : 2, weight: 7,
      text: `以成本 ${profile.cost} 元计，当前${fl >= 0 ? '浮盈' : '浮亏'} ${Math.abs(fl).toFixed(2)}%${fl < 0 ? '，处于成本保护区间，须严格执行减仓纪律' : ''}`,
      evidence: `成本 ${profile.cost} / 现价 ${P}`
    });
  }

  /* --- 估值规则 --- */
  const V = profile.valuation || {};
  if (quote?.peTtm != null && V.fairPe) {
    const [lo, hi] = V.fairPe;
    const pe = quote.peTtm;
    if (pe < lo) push({ id: 'pf-pe-low', dim: '估值水平', name: 'PE低于合理区间', side: 'bull', strength: 4, weight: 8,
      text: `当前 PE(TTM) ${pe} 倍，低于报告参照的合理区间 ${lo}-${hi} 倍，安全边际抬升`,
      evidence: `PE(TTM) ${pe} 倍｜合理区间 ${lo}-${hi} 倍｜对比：${V.benchmark || "—"}（数据源：腾讯行情）` });
    else if (pe > hi) push({ id: 'pf-pe-high', dim: '估值水平', name: 'PE高于合理区间', side: 'bear', strength: 4, weight: 8,
      text: `当前 PE(TTM) ${pe} 倍，高于报告参照的合理区间 ${lo}-${hi} 倍，估值透支风险上升`,
      evidence: `PE(TTM) ${pe} 倍｜合理区间 ${lo}-${hi} 倍｜对比：${V.benchmark || "—"}（数据源：腾讯行情）` });
    else push({ id: 'pf-pe-fair', dim: '估值水平', name: 'PE处于合理区间', side: 'neutral', strength: 2, weight: 6,
      text: `当前 PE(TTM) ${pe} 倍，落在报告参照区间 ${lo}-${hi} 倍内，估值中性`,
      evidence: `PE(TTM) ${pe} 倍｜合理区间 ${lo}-${hi} 倍｜对比：${V.benchmark || "—"}（数据源：腾讯行情）` });
  }

  /* --- 监控清单中的可自动判定项 --- */
  for (const m of (profile.monitors || [])) {
    if (!m.auto) continue;
    if (m.auto === 'valuationPE' && quote?.peTtm != null) {
      const pe = quote.peTtm;
      const bull = /35倍以下|行业均值下方/.test(m.bull) ? pe < 35 : pe < 30;
      const bear = /50倍|显著高于/.test(m.bear) ? pe > 50 : pe > 60;
      if (bull || bear) {
        push({ id: `mon-${m.dim}`, dim: m.dim, name: `${m.metric}${bull ? '达标' : '恶化'}`,
          side: bull ? 'bull' : 'bear', strength: 3, weight: m.weight,
          text: bull ? m.bull : m.bear, evidence: `PE(TTM) ${pe}（观察窗口：${m.window}）` });
      }
    }
  }

  return s;
}

/* ================================================================== */
/* C. 通用监控清单（无画像标的的兜底）                                  */
/* ================================================================== */
/**
 * 没有专项研报画像时，用实时技术状态生成一套等价的盯盘清单。
 *
 * 为什么需要：画像清单来自投研文档，只有少数标的才有。此前的实现在无画像时
 * 会把整张监控清单卡片隐藏掉，导致"盯了别的股票却看不到任何监控项"。
 * 这里给出通用模板 —— 回答同样的三个问题：看什么、什么算好、什么算坏。
 *
 * 注意：生成的是"观察清单"（该盯哪些位、什么条件触发），不重复产出信号；
 * 各项是否触发由既有的技术规则负责判定。
 */
function genericMonitors(ctx) {
  const { ind, quote } = ctx;
  if (!ind) return [];

  const n2 = (v) => (v == null || !Number.isFinite(v) ? '—' : Number(v).toFixed(2));
  const ma = ind.ma || {};
  const kdj = ind.kdj || {};
  const rows = [];
  const push = (m) => rows.push(m);

  /* 1. 趋势结构 */
  push({
    dim: '趋势结构',
    metric: `MA20 ${n2(ma.ma20)} / MA60 ${n2(ma.ma60)}`,
    window: '每日收盘',
    bull: '价格站上 MA20，且 MA20 走平或上翘',
    bear: '收盘跌破 MA60，且 MA60 拐头向下',
    weight: 10,
    now: ind.maArrangement === 'bull' ? '多头排列'
      : ind.maArrangement === 'bear' ? '空头排列'
        : ind.price > ma.ma20 ? '价格在 MA20 上方，均线纠缠' : '价格在 MA20 下方，均线纠缠'
  });

  /* 2. 中期支撑 */
  push({
    dim: '中期支撑',
    metric: `MA20 支撑位 ${n2(ma.ma20)}`,
    window: '每日',
    bull: `回踩 ${n2(ma.ma20)} 附近不破并收出阳线`,
    bear: `有效跌破 ${n2(ma.ma20)}（收盘价连续 2 日在下方）`,
    weight: 9,
    now: `现价 ${n2(ind.price)}，偏离 MA20 ${ma.ma20 ? (((ind.price - ma.ma20) / ma.ma20) * 100).toFixed(2) : '—'}%`
  });

  /* 3. MACD 动能 */
  push({
    dim: 'MACD 动能',
    metric: `DIF ${n2(ind.macd?.dif)} / DEA ${n2(ind.macd?.dea)}`,
    window: '每日',
    bull: 'DIF 上穿 DEA 形成金叉，且 DIF 站上零轴',
    bear: 'DIF 下穿 DEA 形成死叉，且绿柱持续放大',
    weight: 8,
    now: ind.macd ? `${ind.macd.dif >= ind.macd.dea ? 'DIF 在 DEA 上方' : 'DIF 在 DEA 下方'}，红绿柱 ${n2(ind.macd.hist)}` : '—'
  });

  /* 4. RSI 强弱 */
  push({
    dim: 'RSI 强弱',
    metric: `RSI(14) ${n2(ind.rsi)}`,
    window: '每日',
    bull: 'RSI 上穿 50 并站稳',
    bear: 'RSI 跌破 30，或自 80 以上高位掉头',
    weight: 7,
    now: ind.rsi == null ? '—'
      : ind.rsi >= 80 ? '超买区，警惕回落'
        : ind.rsi <= 30 ? '超卖区，存在反弹需求'
          : ind.rsi >= 50 ? '中性偏强' : '中性偏弱'
  });

  /* 5. 布林轨道 */
  push({
    dim: '布林轨道',
    metric: `上轨 ${n2(ind.boll?.up)} / 中轨 ${n2(ind.boll?.mid)} / 下轨 ${n2(ind.boll?.dn)}`,
    window: '每日',
    bull: '收复中轨，并向中轨上方扩展',
    bear: '跌破下轨，或上轨遇阻后放量回落',
    weight: 8,
    now: ind.bollInfo
      ? `%B ${(ind.bollInfo.pctB * 100).toFixed(0)}%，带宽 ${ind.bollInfo.bandwidthPct}%（历史分位 ${ind.bollInfo.bandwidthPctile}%）${ind.bollInfo.stateLabel}`
      : '—'
  });

  /* 6. 回归导轨 */
  push({
    dim: '回归导轨',
    metric: `导轨 ${n2(ind.rails?.dn)} ~ ${n2(ind.rails?.up)}（${ind.rails?.bars || '—'} 根，k=${ind.rails?.k ?? '—'}）`,
    window: '每日',
    bull: '上升导轨中回踩下沿获支撑',
    bear: '下降导轨中跌破下轨，趋势延续',
    weight: 8,
    now: ind.rails
      ? `${ind.rails.dir === 'up' ? '上升导轨' : ind.rails.dir === 'down' ? '下降导轨' : '水平导轨'}｜斜率 ${ind.rails.slope20Pct}%/20日｜通道位置 ${(ind.rails.pctChan * 100).toFixed(0)}%`
      : '—'
  });

  /* 7. 量价配合 */
  push({
    dim: '量价配合',
    metric: `量比 ${quote?.volumeRatio == null ? '—' : quote.volumeRatio} / 换手 ${quote?.turnover == null ? '—' : quote.turnover + '%'}`,
    window: '每日',
    bull: '放量突破关键阻力位（量比 > 1.5）',
    bear: '放量下跌或缩量反弹无力',
    weight: 7,
    now: quote?.volumeRatio == null ? '—'
      : quote.volumeRatio >= 1.5 ? '明显放量'
        : quote.volumeRatio <= 0.7 ? '明显缩量' : '量能正常'
  });

  /* 8. 关键区间 */
  push({
    dim: '关键区间',
    metric: `20日 ${n2(ind.donchian?.lower)} ~ ${n2(ind.donchian?.upper)}`,
    window: '每日',
    bull: '突破 20 日高点并有效站稳',
    bear: '跌破 20 日低点',
    weight: 7,
    now: `区间位置 ${ind.donchian?.pct ?? '—'}%｜52周位置 ${ind.position52 ?? '—'}%`
  });

  return rows;
}

/* ================================================================== */
/* 评分                                                                */
/* ================================================================== */
function scoreSignals(signals, filter) {
  const list = filter ? signals.filter(filter) : signals;
  let num = 0, den = 0;
  for (const s of list) {
    const dir = s.side === 'bull' ? 1 : s.side === 'bear' ? -1 : 0;
    const sc = dir * (s.strength / 5);
    num += sc * s.weight;
    den += s.weight;
  }
  if (!den) return 50;
  return clamp(Math.round(50 + 45 * (num / den)), 2, 98);
}

module.exports = { technicalRules, channelRules, profileRules, genericMonitors, scoreSignals, clamp };
