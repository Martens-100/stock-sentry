'use strict';
/**
 * 投研报告 / 持仓攻略 自动生成器
 * 完全模仿《中兴投研持仓攻略》与《科伦药业投研尽调报告》的 8 章结构与行文逻辑，
 * 对任意标的输出同构报告：实时盯盘结论 + 基本面框架 + 监控清单 + 操作纪律。
 */
const profilesData = require('../data/profiles.json');

const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '—');
const pct = (x) => (x == null ? '—' : `${x > 0 ? '+' : ''}${x.toFixed(2)}%`);
const money = (x) => (x == null ? '—' : x >= 1e8 ? `${(x / 1e8).toFixed(2)}亿元` : `${(x / 1e4).toFixed(0)}万元`);
const tag = (x) => (x > 0 ? '🔴' : x < 0 ? '🟢' : '⚪');

function signalTable(signals) {
  if (!signals.length) return '_暂无显著信号_';
  const rows = signals.map((s) => {
    const side = s.side === 'bull' ? '**利好**' : s.side === 'bear' ? '**利空**' : '中性';
    const stars = '★'.repeat(Math.max(1, Math.min(5, Math.round(s.strength))));
    const dir = s.side === 'bull' ? '🔴' : s.side === 'bear' ? '🟢' : '⚪';
    return `| ${dir} ${side} | ${s.dim} | ${s.name} ${stars} | ${s.text} | ${s.evidence} |`;
  });
  return ['| 方向 | 维度 | 信号 | 判读 | 数据依据 |', '| --- | --- | --- | --- | --- |', ...rows].join('\n');
}

function monitorTable(monitors) {
  if (!monitors?.length) return '_该标的未配置专项监控清单，建议补充投研文档后回填。_';
  const rows = monitors.map((m) =>
    `| ${m.dim} | ${m.metric} | ${m.window} | 🔴 ${m.bull} | 🟢 ${m.bear} | ${m.weight} |`);
  return ['| 跟踪维度 | 关键指标 | 观察窗口 | 利好信号 | 利空信号 | 权重 |', '| --- | --- | --- | --- | --- | --- |', ...rows].join('\n');
}

/* ------------------------------------------------------------------ */
function buildReport(a) {
  const { quote: q, ind, profile: pf, scores, action, plan, signals, flow, chart } = a;
  const now = new Date();
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
  const L = [];
  const hasProfile = !!pf;

  L.push(`# ${a.name}（${a.code}）投研报告与持仓攻略`);
  L.push('');
  L.push(`> **报告日期：** ${dateStr}　**标的：** ${a.name}（${a.code}${a.market === 'sh' ? '.SH' : a.market === 'sz' ? '.SZ' : '.BJ'}）　**最新价：** ${f2(q.price)} 元　**总市值：** ${q.totalCap ? q.totalCap.toFixed(0) + '亿元' : '—'}`);
  if (hasProfile) L.push(`> **画像来源：** ${pf.sourceDoc}${pf.reportDate ? `（原报告日期 ${pf.reportDate}）` : ''}`);
  L.push(`> **团队构成：** ${profilesData.template.team.join(' / ')}`);
  L.push('');
  L.push('---');
  L.push('');

  /* ============ 实时盯盘面板（新增，实时化） ============ */
  L.push('## ⟡ 实时盯盘面板（Live Monitor）');
  L.push('');
  L.push(`| 指标 | 数值 | 指标 | 数值 |`);
  L.push(`| --- | --- | --- | --- |`);
  L.push(`| 现价 | **${f2(q.price)}** 元 ${tag(q.changePct)} | 涨跌幅 | ${pct(q.changePct)} |`);
  L.push(`| 今开 / 昨收 | ${f2(q.open)} / ${f2(q.preClose)} | 最高 / 最低 | ${f2(q.high)} / ${f2(q.low)} |`);
  L.push(`| 成交额 | ${money(q.amount)} | 换手率 / 量比 | ${q.turnover != null ? q.turnover + '%' : '—'} / ${q.volumeRatio != null ? q.volumeRatio : '—'} |`);
  L.push(`| PE(TTM) / PB | ${q.peTtm ?? '—'} / ${q.pb ?? '—'} | 52周位置 | ${ind.position52}%（${ind.low52}~${ind.high52}） |`);
  L.push(`| MA5 / MA20 / MA60 | ${ind.ma.ma5}/${ind.ma.ma20}/${ind.ma.ma60} | ATR / 波动率 | ${ind.atr}（${ind.atrPct}%） |`);
  if (flow?.today) L.push(`| 主力资金 | ${flow.today.main >= 0 ? '净流入' : '净流出'} ${money(Math.abs(flow.today.main))} | 资金口径 | ${flow.source === 'eastmoney' ? '东方财富主力单' : flow.source === 'estimate' ? '分时主动买卖估算' : '不可用'} |`);
  L.push('');
  L.push(`### 综合判定：${action.label}　%%评分 ${scores.composite} / 100%%`);
  L.push('');
  L.push(`- **技术面评分：** ${scores.technical} / 100`);
  L.push(`- **策略面评分：** ${scores.profile ?? '（无画像）'} / 100`);
  L.push(`- **判定置信度：** ${action.confidence}%`);
  L.push(`- **操作含义：** ${action.desc}`);
  L.push('');
  L.push('**判定依据：**');
  action.reasons.forEach((r) => L.push(`- ${r}`));
  L.push('');

  /* ============ 上下轨线与导轨区间 ============ */
  const cv = ind.channelVerdict;
  if (cv) {
    const bi = ind.bollInfo, ra = ind.rails, dc = ind.donchian;
    L.push('## ⟡ 上下轨线与导轨区间研判');
    L.push('');
    L.push(`### 所在区间：${cv.zone}`);
    L.push('');
    L.push(`> ${cv.advice}`);
    L.push('');
    L.push('| 轨道系统 | 上轨 / 上沿 | 中轨 | 下轨 / 下沿 | 当前位置 | 状态 |');
    L.push('| --- | --- | --- | --- | --- | --- |');
    L.push(`| 布林轨道（20,2） | ${cv.boll.up} | ${cv.boll.mid} | ${cv.boll.dn} | %B ${bi ? (bi.pctB * 100).toFixed(0) : '—'}% | ${bi ? bi.stateLabel : '—'}（带宽 ${bi ? bi.bandwidthPct : '—'}%，近120日 ${bi ? bi.bandwidthPctile : '—'}% 分位） |`);
    if (ra) L.push(`| 回归导轨通道 | ${ra.up} | ${ra.mid} | ${ra.dn} | ${(ra.pctChan * 100).toFixed(0)}% | ${cv.railDirLabel}｜${ra.bars}根窗口 k=${ra.k}｜斜率 ${ra.slope20Pct}%/20日｜通道宽 ${ra.widthPct}%${ra.reliable ? '' : '｜⚠宽度过大、参考性弱'} |`);
    if (dc) L.push(`| 唐奇安区间（20日） | ${dc.upper} | ${dc.mid} | ${dc.lower} | ${dc.pct}% | 区间宽度 ${(dc.upper - dc.lower).toFixed(2)} 元 |`);
    L.push('');
    L.push(`**轨道操作系统性判读：**`);
    L.push('');
    L.push(`- 布林带：${cv.bollLabel}${bi?.state === 'squeeze' ? '；带宽收口至历史低位，属变盘前的能量积蓄，方向确认前不宜重仓' : bi?.state === 'expand' ? '；带宽开口放大，趋势处于加速阶段' : ''}`);
    if (ra) L.push(`- 回归导轨：${cv.railDirLabel}，价格处于${cv.railPosLabel}（${(ra.pctChan * 100).toFixed(0)}%）；轨内交易原则为「下沿买、上沿卖、中部不动」`);
    if (dc) L.push(`- 唐奇安区间：${dc.lower} ~ ${dc.upper}，当前位于区间 ${dc.pct}% 位置，${dc.pct >= 90 ? '已逼近区间上沿，突破则趋势延续、受阻则回落' : dc.pct <= 10 ? '已逼近区间下沿，跌破则区间破位' : '区间内运行，未形成方向性突破'}`);
    L.push('');
    L.push('> *轨道口径说明：布林带为 20 日移动均线 ±2 倍标准差；回归导轨为最小二乘线性回归中轨 ±k 倍残差标准差（窗口与 k 值自适应收窄，确保通道宽度可解读）；唐奇安区间为近 20 个交易日最高价与最低价。以上均为技术统计口径，不构成对基本面的判断。*');
    L.push('');
    L.push('---');
    L.push('');
  }

  /* ============ 一、执行摘要 ============ */
  L.push(`## 一、执行摘要（Executive Summary）`);
  L.push('');
  if (hasProfile && pf.thesis) {
    L.push(pf.thesis);
    L.push('');
    if (pf.moat) L.push(`**技术/竞争壁垒：** ${pf.moat}`);
  } else {
    L.push(`**${a.name}（${a.code}）** 当前纳入通用投研模板跟踪。系统基于实时行情（现价 ${f2(q.price)} 元，区间位置 ${ind.position52}%）、`
      + `技术结构（均线${ind.maArrangement === 'bull' ? '多头' : ind.maArrangement === 'bear' ? '空头' : '纠缠'}排列，MACD ${ind.macd.hist >= 0 ? '红柱' : '绿柱'}，RSI ${ind.rsi}）与估值水平（PE(TTM) ${q.peTtm ?? '—'} 倍）`
      + `给出量化信号；但**个股专属画像缺失**，第四节至第七节的基本面拆解需补充专项研报后由系统回填。`);
  }
  L.push('');
  L.push(`**当前阶段定位：** ${ind.position52 <= 20 ? '处于52周区间底部，属于左侧区间' : ind.position52 >= 80 ? '处于52周区间高位，需警惕追高风险' : '处于52周区间中段，方向待选择'}；`
    + `技术面综合评分 ${scores.technical} 分，判定为「**${action.label}**」。`);
  L.push('');

  /* ============ 二、财务与估值透视 ============ */
  L.push(`## 二、财务与估值透视`);
  L.push('');
  if (hasProfile && pf.fundamentals && Object.keys(pf.fundamentals).length) {
    const F = pf.fundamentals;
    L.push('**1. 财务基本面（源自投研文档）**');
    L.push('');
    L.push('| 指标 | 数值 |');
    L.push('| --- | --- |');
    const label = {
      revenue2025: '2025年营业收入', netProfit2025: '2025年归母净利润', revenueQ1_2026: '2026Q1营业收入',
      netProfitQ1_2026: '2026Q1归母净利润', grossMargin2025: '2025年毛利率', grossMarginQ1_2026: '2026Q1毛利率',
      cashFlow2025: '2025年经营现金流', cashFlowQ1_2026: '2026Q1经营现金流', roe: 'ROE', debtRatio: '资产负债率',
      receivables: '应收账款', consensus2026: '机构一致预期2026'
    };
    Object.entries(F).forEach(([k, v]) => L.push(`| ${label[k] || k} | ${v} |`));
    L.push('');
  } else {
    L.push('**1. 财务基本面**：_该标的尚未导入财务数据，建议补充最新定期报告或调研数据。_');
    L.push('');
  }
  L.push('**2. 估值水平（实时）**');
  L.push('');
  L.push('| 估值指标 | 当前水平 | 参照基准 | 判读 |');
  L.push('| --- | --- | --- | --- |');
  const V = pf?.valuation || {};
  const refLow = V.fairPe?.[0], refHigh = V.fairPe?.[1];
  const peJudge = q.peTtm == null ? '—' : refLow != null ? (q.peTtm < refLow ? '低于合理区间，安全边际抬升' : q.peTtm > refHigh ? '高于合理区间，估值透支风险' : '处于合理区间，估值中性') : '—';
  L.push(`| 市盈率 PE(TTM) | ${q.peTtm ?? '—'} 倍 | ${refLow ? `${refLow}-${refHigh} 倍` : '行业均值'} | ${peJudge} |`);
  L.push(`| 市盈率 PE(动) / PE(静) | ${q.peDynamic ?? '—'} / ${q.peStatic ?? '—'} 倍 | — | 不同口径下的估值参照 |`);
  L.push(`| 市净率 PB | ${q.pb ?? '—'} 倍 | ${V.benchmark || '行业均值'} | — |`);
  L.push(`| 总市值 | ${q.totalCap ? q.totalCap.toFixed(0) + ' 亿元' : '—'} | 流通市值 ${q.floatCap ? q.floatCap.toFixed(0) + ' 亿元' : '—'} | — |`);
  L.push(`| 52周价格区间 | ${ind.low52} ~ ${ind.high52} 元 | 当前位置 ${ind.position52}% | ${ind.position52 <= 20 ? '底部区域' : ind.position52 >= 80 ? '高位区域' : '中位区域'} |`);
  L.push('');
  if (V.note) { L.push(`> ${V.note}`); L.push(''); }

  /* ============ 三、经营与市占率拆解 ============ */
  L.push(`## 三、经营与市占率拆解`);
  L.push('');
  if (hasProfile && pf.businessMix?.length) {
    L.push('| 业务板块 | 收入占比 | 趋势 | 要点 |');
    L.push('| --- | --- | --- | --- |');
    pf.businessMix.forEach((b) => L.push(`| ${b.name} | ${b.share}% | ${b.trend} | ${b.note} |`));
    L.push('');
  } else {
    L.push('_业务结构数据缺失，需补充公司年报/半年报的分部收入数据。_');
    L.push('');
  }
  const bears = signals.bear.slice(0, 5);
  if (bears.length) {
    L.push('**经营与交易层面当前隐患（实时识别）：**');
    L.push('');
    bears.forEach((b) => L.push(`- 🟢 **${b.name}**：${b.text}（${b.evidence}）`));
    L.push('');
  }

  /* ============ 四、风险控制 ============ */
  L.push(`## 四、风险控制（Risk Consulting）`);
  L.push('');
  if (hasProfile && pf.risks?.length) {
    pf.risks.forEach((r, i) => L.push(`${i + 1}. ${r}`));
  } else {
    L.push('1. _该标的尚未录入专项风险清单。_');
  }
  L.push('');
  L.push('**实时风险度量：**');
  L.push('');
  L.push(`- 波动率（ATR占价格比）：${ind.atrPct}%，${ind.atrPct > 5 ? '波动剧烈，仓位需相应下调' : ind.atrPct > 3 ? '波动偏高，注意控制单笔仓位' : '波动温和'}`);
  L.push(`- 最大回撤（距52周高点）：${pct(ind.drawdownFromHigh ?? ((q.price - ind.high52) / ind.high52 * 100))}`);
  if (plan.stopLoss) L.push(`- 距止损位空间：${f2(((q.price - plan.stopLoss) / q.price) * 100)}%（止损位 ${plan.stopLoss} 元）`);
  L.push('');

  /* ============ 五、筹码结构 ============ */
  L.push(`## 五、长线投资者：筹码结构与散户拥挤度`);
  L.push('');
  if (hasProfile && pf.chips && !/待补充/.test(pf.chips)) {
    L.push(pf.chips);
  } else {
    L.push('_股东户数、机构持仓、融资余额等筹码数据需从定期披露或数据终端补充。_');
  }
  L.push('');
  if (q.outer != null && q.inner != null && q.outer + q.inner > 0) {
    const r = q.outer / (q.outer + q.inner);
    L.push(`**当日盘口博弈（实时）：** 外盘 ${q.outer} 手 / 内盘 ${q.inner} 手，外盘占比 ${(r * 100).toFixed(1)}% —— ${r > 0.55 ? '买盘主动性强，短线人气偏暖' : r < 0.45 ? '卖盘主动性占优，短线承压' : '多空相对均衡'}。`);
  }
  L.push('');

  /* ============ 六、团队综合研判 ============ */
  L.push(`## 六、团队综合研判`);
  L.push('');
  L.push(`**好的一面：**`);
  L.push('');
  const topBull = signals.bull.slice(0, 4);
  if (topBull.length) topBull.forEach((s) => L.push(`- 🔴 ${s.name}：${s.text}`));
  else L.push('- 暂未识别到显著利多信号');
  L.push('');
  L.push(`**坏的一面：**`);
  L.push('');
  const topBear = signals.bear.slice(0, 4);
  if (topBear.length) topBear.forEach((s) => L.push(`- 🟢 ${s.name}：${s.text}`));
  else L.push('- 暂未识别到显著利空信号');
  L.push('');
  L.push(`**核心结论：** ${hasProfile && pf.verdictNote ? pf.verdictNote + ' ' : ''}结合实时数据，当前综合评分 **${scores.composite}** 分，`
    + `系统给出的操作结论为「**${action.label}**」——${action.desc}。`);
  L.push('');

  /* ============ 七、产业链与业绩兑现节奏 ============ */
  L.push(`## 七、产业链与业绩兑现节奏`);
  L.push('');
  if (hasProfile && pf.catalysts?.length && !/待补充/.test(pf.catalysts[0]?.time || '')) {
    L.push('| 时间节点 | 催化/交付内容 | 金额/规模 | 业绩影响 |');
    L.push('| --- | --- | --- | --- |');
    pf.catalysts.forEach((c) => L.push(`| ${c.time} | ${c.event} | ${c.amount} | ${c.impact} |`));
    L.push('');
    L.push(`> 关键验证窗口：${pf.catalysts[1]?.time || pf.catalysts[0]?.time || '—'} —— 该节点的兑现程度将直接决定当前估值的切换方向。`);
  } else {
    L.push('_业绩兑现节奏表需依据公司订单/产能/管线节点补充。_');
  }
  L.push('');

  /* ============ 八、持仓攻略 ============ */
  L.push(`## 八、持仓攻略：策略建议与操作纪律`);
  L.push('');
  L.push(`### 1. 当前位置与结论`);
  L.push('');
  L.push(`| 项目 | 数值 |`);
  L.push(`| --- | --- |`);
  L.push(`| 最新价 | ${f2(q.price)} 元 |`);
  if (pf?.cost) L.push(`| 持仓成本 | ${pf.cost} 元（${(((q.price - pf.cost) / pf.cost) * 100).toFixed(2)}%） |`);
  L.push(`| 系统结论 | **${action.label}** |`);
  L.push(`| 综合评分 | ${scores.composite} / 100 |`);
  L.push(`| 建议仓位上限 | 总资产的 ${plan.positionLimitPct}% |`);
  L.push('');
  L.push(`### 2. 交易计划`);
  L.push('');
  L.push('| 类型 | 价位 | 说明 |');
  L.push('| --- | --- | --- |');
  if (plan.entry?.[0]) L.push(`| 建仓区间 | ${plan.entry[0]} ~ ${plan.entry[1]} 元 | ${plan.fromProfile ? '来自投研报告给定的建仓区间' : '基于 ATR 波动率推算'}${plan.batchKind === 'exit' ? ' ⚠ 当前判定为不宜建仓，仅供回踩参考' : ''} |`);
  L.push(`| 第一目标位 | ${plan.target1} 元 | 距现价 ${f2(((plan.target1 - q.price) / q.price) * 100)}% |`);
  L.push(`| 第二目标位 | ${plan.target2} 元 | 距现价 ${f2(((plan.target2 - q.price) / q.price) * 100)}% |`);
  L.push(`| 止损位 | ${plan.stopLoss} 元 | 距现价 ${f2(((q.price - plan.stopLoss) / q.price) * 100)}% |`);
  L.push(`| 硬止损位 | ${plan.hardStop} 元 | 跌破无条件离场 |`);
  L.push(`| 盈亏比 | ${plan.riskReward ? plan.riskReward + ' : 1' : '不适用'} | ${plan.riskReward ? (plan.riskReward >= 2 ? '风险收益比良好' : plan.riskReward >= 1 ? '风险收益比一般' : '风险大于收益，不建议参与') : (plan.rrNote || '—')} |`);
  L.push('');
  if (pf?.takeProfit?.length) {
    L.push('**分档止盈纪律（源自投研文档）：**');
    L.push('');
    pf.takeProfit.forEach((t) => L.push(`- **${t.level}（${t.range[0]}-${t.range[1]} 元）**：${t.note}`));
    L.push('');
  }
  const exitKind = plan.batchKind === 'exit';
  L.push(exitKind ? '**仓位处置节奏（当前不宜建仓）：**' : plan.batchKind === 'conditional' ? '**条件性建仓节奏（需信号确认后执行）：**' : '**分批建仓节奏：**');
  L.push('');
  L.push(`| ${exitKind ? '步骤' : '批次'} | 触发条件 | 处置比例 | 说明 |`);
  L.push('| --- | --- | --- | --- |');
  plan.batches.forEach((b, i) => L.push(`| 第 ${i + 1} ${exitKind ? '步' : '批'} | ${b.at} | ${b.ratio} | ${b.note} |`));
  L.push('');
  L.push('**关键支撑 / 阻力位（实时计算）：**');
  L.push('');
  L.push('| 类型 | 价位 | 距现价 | 强度 |');
  L.push('| --- | --- | --- | --- |');
  plan.supports.slice(0, 4).forEach((s) => L.push(`| 支撑 | ${s.price}${s.label ? ` (${s.label})` : ''} | ${s.dist}% | ${'●'.repeat(Math.min(3, s.count || 1))} |`));
  plan.resistances.slice(0, 4).forEach((s) => L.push(`| 阻力 | ${s.price}${s.label ? ` (${s.label})` : ''} | +${s.dist}% | ${'●'.repeat(Math.min(3, s.count || 1))} |`));
  L.push('');

  L.push(`### 3. 核心监控清单（利好 / 利空双向）`);
  L.push('');
  L.push(monitorTable(pf?.monitors));
  L.push('');

  L.push(`### 4. 实时信号明细（${signals.all.length} 条）`);
  L.push('');
  L.push(signalTable(signals.all.slice(0, 24)));
  L.push('');

  L.push('---');
  L.push('');
  L.push(`*本报告由 StockSentry 智能盯盘系统于 ${now.toLocaleString('zh-CN')} 自动生成。行情与轨道类指标数据来自腾讯财经公开接口（成交额口径为人民币），财务与业务数据来自用户提供的投研文档（${hasProfile ? pf.sourceDoc : '未提供'}）。技术指标均为公开算法统计口径，可自行复算验证。*`);
  L.push('');
  L.push('**免责声明：** 以上内容基于公开数据和量化分析，仅供参考，不构成投资建议。市场有风险，投资需谨慎。任何投资决策应结合个人风险承受能力、资金状况和投资目标独立判断，必要时咨询持牌专业机构。过往表现不预示未来收益。');

  return L.join('\n');
}

/* ------------------------------------------------------------------ */
/* 极简 Markdown → HTML（支持标题/表格/列表/加粗/引用/分隔线）        */
/* ------------------------------------------------------------------ */
function mdToHtml(md) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // 先将 %%...%% 抽出为占位符，避免被 HTML 转义破坏
  const inline = (s) => {
    const tokens = [];
    let t = String(s).replace(/%%(.+?)%%/g, (_, x) => { tokens.push(x); return `\u0000${tokens.length - 1}\u0000`; });
    t = esc(t)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>');
    return t.replace(/\u0000(\d+)\u0000/g, (_, i) => `<span class="badge">${tokens[+i]}</span>`);
  };

  const lines = md.split('\n');
  const out = [];
  let inTable = false, inList = false, inQuote = false;

  const closeAll = () => {
    if (inTable) { out.push('</tbody></table>'); inTable = false; }
    if (inList) { out.push('</ul>'); inList = false; }
    if (inQuote) { out.push('</blockquote>'); inQuote = false; }
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();

    if (/^\|/.test(line)) {
      const cells = line.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      if (/^-{2,}|^:?-+:?$/.test(cells[0]) && cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
      if (!inTable) {
        closeAll();
        out.push('<table><thead><tr>' + cells.map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>');
        inTable = true;
      } else {
        out.push('<tr>' + cells.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>');
      }
      continue;
    }
    if (inTable && !/^\|/.test(line)) { out.push('</tbody></table>'); inTable = false; }

    if (/^---+$/.test(line)) { closeAll(); out.push('<hr>'); continue; }
    if (!line) { closeAll(); continue; }

    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { closeAll(); out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); continue; }

    if (/^>\s?/.test(line)) {
      if (!inQuote) { closeAll(); out.push('<blockquote>'); inQuote = true; }
      out.push(`<p>${inline(line.replace(/^>\s?/, ''))}</p>`);
      continue;
    }
    if (inQuote) { out.push('</blockquote>'); inQuote = false; }

    if (/^[-*]\s+/.test(line)) {
      if (!inList) { closeAll(); out.push('<ul>'); inList = true; }
      out.push(`<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`);
      continue;
    }
    if (inList) { out.push('</ul>'); inList = false; }

    out.push(`<p>${inline(line)}</p>`);
  }
  closeAll();
  return out.join('\n');
}

function standaloneHtml(title, body) {
  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
:root{--bg:#f6f7f9;--card:#fff;--ink:#1c1f23;--muted:#6b7280;--line:#e5e7eb;--red:#c62828;--green:#2e7d32}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.75 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
.wrap{max-width:940px;margin:0 auto;padding:40px 28px 80px;background:var(--card);min-height:100vh;
box-shadow:0 0 0 1px var(--line)}
h1{font-size:26px;margin:0 0 18px;padding-bottom:14px;border-bottom:3px solid var(--red)}
h2{font-size:19px;margin:36px 0 14px;padding-left:11px;border-left:4px solid var(--red)}
h3{font-size:16px;margin:24px 0 10px;color:#374151}
h4{font-size:15px;margin:20px 0 8px}
table{border-collapse:collapse;width:100%;margin:14px 0;font-size:13.5px}
th,td{border:1px solid var(--line);padding:8px 10px;text-align:left;vertical-align:top}
th{background:#f3f4f6;font-weight:600;white-space:nowrap}
tbody tr:nth-child(even){background:#fafafa}
blockquote{margin:12px 0;padding:10px 16px;background:#f9fafb;border-left:3px solid #d1d5db;color:#4b5563;font-size:13.5px}
blockquote p{margin:3px 0}
code{background:#f3f4f6;padding:1px 5px;border-radius:4px;font-size:12.5px}
hr{border:0;border-top:1px solid var(--line);margin:28px 0}
ul{margin:10px 0;padding-left:22px}li{margin:5px 0}
.badge{display:inline-block;background:#eef2ff;color:#3730a3;padding:1px 9px;border-radius:99px;font-size:12px}
strong{color:#111827}
p{margin:10px 0}
</style></head>
<body><div class="wrap">${body}</div></body></html>`;
}

module.exports = { buildReport, mdToHtml, standaloneHtml };
