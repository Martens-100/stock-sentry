/*! StockSentry 静态运行时 —— 由 build-static.js 自动生成，请勿手工编辑。源码见 lib/ */
(function () {
'use strict';

var __registry = {};
var __cache = {};

function __define(name, fn) { __registry[name] = fn; }

function __require(name) {
  if (name === 'profiles') return PROFILES_DATA;
  if (__cache[name]) return __cache[name].exports;
  var m = { exports: {} };
  __cache[name] = m;
  var fn = __registry[name];
  if (!fn) throw new Error('[bundle] 模块未找到: ' + name);
  fn(m, m.exports, __require);
  return m.exports;
}

var PROFILES_DATA = {
  "version": "1.0.0",
  "template": {
    "source": "中兴投研持仓攻略.docx / 科伦药业投研尽调报告(pdf)",
    "team": ["二级市场投研", "一级市场产业研究", "Risk Consulting", "芯片组专研", "战略分析"],
    "sections": [
      { "id": "summary", "no": "一", "title": "执行摘要（Executive Summary）", "hint": "战略转型定位 + 核心矛盾 + 关键拐点" },
      { "id": "fundamental", "no": "二", "title": "财务与估值透视", "hint": "财务基本面 + 估值水平 + 边际改善" },
      { "id": "business", "no": "三", "title": "经营与市占率拆解", "hint": "核心业务分拆 + 经营隐忧" },
      { "id": "risk", "no": "四", "title": "风险控制（Risk Consulting）", "hint": "合规与治理排雷" },
      { "id": "chips", "no": "五", "title": "长线投资者：筹码结构与散户拥挤度", "hint": "股东户数 + 机构持仓 + 资金博弈" },
      { "id": "verdict", "no": "六", "title": "团队综合研判", "hint": "好的一面 / 坏的一面 / 核心结论" },
      { "id": "chain", "no": "七", "title": "产业链与业绩兑现节奏", "hint": "产业链传导 + 业绩兑现时间表" },
      { "id": "strategy", "no": "八", "title": "持仓攻略：策略建议与操作纪律", "hint": "建仓区间 / 止盈 / 止损 / 仓位 / 监控清单" }
    ],
    "monitorModel": {
      "note": "利好/利空双向监控清单，源自两份报告的核心跟踪指标表",
      "fields": ["dim 跟踪维度", "metric 关键指标", "window 观察窗口", "bull 利好信号", "bear 利空信号", "weight 权重(1-10)"]
    }
  },

  "profiles": {
    "000063": {
      "code": "000063",
      "market": "sz",
      "name": "中兴通讯",
      "tags": ["AI算力", "通信设备", "自研芯片", "超节点"],
      "sourceDoc": "中兴投研持仓攻略(1).docx",
      "reportDate": "2026-08-14",
      "thesis": "市场仍用『通信设备商』旧框架给估值（PE约37倍），但公司实质已演变为『芯片+算力基础设施+AI终端』的全栈AI玩家：算力营收占比从2025年24.6%升至2026Q1的27%，中兴微电子（GPU/CPU/DPU/交换芯片全品类）中性估值1900-2400亿元已接近母公司全部市值。",
      "moat": "7nm/5nm Chiplet；51.2T交换芯片国内率先商用；OEX正交电交换超节点单机柜128 GPU、Scale-up至1.6万卡。",
      "valuation": {
        "peTtm": 37,
        "pb": 2.24,
        "fairPe": [26, 37],
        "benchmark": "海光信息 PE≈276倍，公司估值被显著压制",
        "note": "若市场认可AI芯片身份，仅中兴微电子一项资产即接近母公司当前总市值。"
      },
      "levels": {
        "entry": [32, 35],
        "addOn": [30, 32],
        "stopLoss": 30,
        "hardStop": 28,
        "target1": 42,
        "target2": 50,
        "positionLimit": 0.15
      },
      "cost": null,
      "catalysts": [
        { "time": "2026H1", "event": "字节ASIC首批交付、阿里JDM持续供货、移动AI推理服务器交付", "amount": "约200亿元", "impact": "算力收入确认加速，毛利率仍爬坡" },
        { "time": "2026Q3", "event": "凌云51.2T批量外供头部云厂、定海DPU放量、珠峰1.0批量应用", "amount": "芯片外销启动", "impact": "高毛利芯片贡献利润，毛利率拐点出现" },
        { "time": "2026Q4", "event": "全年订单集中确认、海外大单交付、AI终端旺季", "amount": "约150-200亿元", "impact": "利润弹性最大季度" },
        { "time": "2027+", "event": "凌云102.4T流片、算力芯片外销占比提升、AI智能体手机规模化", "amount": "持续增长", "impact": "估值从通信股切换为AI算力核心设备股" }
      ],
      "businessMix": [
        { "name": "运营商网络", "share": 46, "trend": "承压", "note": "5G基站/核心网全球第二；三大运营商2026资本开支约2596亿元，同比再降9%" },
        { "name": "政企/算力", "share": 27, "trend": "快速提升", "note": "2025算力营收同比+150%；服务器及存储同比+200%；已进入阿里/腾讯/字节/百度等核心场景" },
        { "name": "消费者业务", "share": 27, "trend": "增长", "note": "手机国内国际双位数增长；努比亚NaviX Ultra搭载豆包手机助手" }
      ],
      "monitors": [
        { "dim": "芯片放量", "metric": "凌云51.2T外销数量", "window": "2026Q3起", "bull": "季度外销超1万片", "bear": "外销延迟或低于5000片", "weight": 10, "auto": null },
        { "dim": "毛利率", "metric": "综合毛利率", "window": "季报", "bull": "回升至32%以上", "bear": "持续低于28%", "weight": 9, "auto": "grossMargin" },
        { "dim": "算力占比", "metric": "算力产品营收占比", "window": "季报", "bull": "持续超30%", "bear": "回落至25%以下", "weight": 8, "auto": "segmentShare" },
        { "dim": "客户拓展", "metric": "互联网大厂订单金额", "window": "公告/调研", "bull": "字节/阿里/腾讯订单超百亿", "bear": "头部客户订单流失", "weight": 8, "auto": null },
        { "dim": "地缘政治", "metric": "欧盟清退法案进展", "window": "持续跟踪", "bull": "无新增制裁", "bear": "新增清退或次级制裁", "weight": 7, "auto": null },
        { "dim": "筹码结构", "metric": "股东户数变化", "window": "每月", "bull": "股东户数不再增加甚至减少", "bear": "户数持续增加、机构继续减仓", "weight": 6, "auto": "chipConcentration" },
        { "dim": "业绩拐点", "metric": "单季归母净利润同比", "window": "季报", "bull": "同比增速转正", "bear": "降幅扩大超30%", "weight": 9, "auto": "profitGrowth" }
      ],
      "fundamentals": {
        "revenue2025": "1338.96亿元(+10.38%)",
        "netProfit2025": "56.18亿元(-33.32%)",
        "revenueQ1_2026": "349.88亿元(+6.13%)",
        "netProfitQ1_2026": "13.10亿元(-46.58%)",
        "grossMarginQ1_2026": "28.28%(-6pct)",
        "cashFlowQ1_2026": "经营活动现金流净额-19.79亿元",
        "receivables": "应收账款248.49亿元",
        "consensus2026": "机构预测2026年净利润56.81-74.96亿元"
      },
      "chips": "股东总数620,363户（2026-07-20），A股620,081户，较1月增加约1万户；人均流通股约6495股（-7.25%）；北向资金1.14%（较上期减少887.54万股）；沪深300ETF普遍减仓。结论：散户拥挤度高、机构态度谨慎。",
      "risks": [
        "业绩不及预期：运营商投资下滑超预期或算力毛利率爬坡慢，2026净利润可能低于56亿元",
        "地缘政治黑天鹅：美国次级制裁、7nm代工受限、欧盟清退加速",
        "芯片量产风险：凌云51.2T批量外供延迟、客户验证不及预期",
        "市场竞争：华为昇腾/鲲鹏生态扩张、海光DCU迭代加速",
        "估值重构失败：市场长期固守通信设备商标签"
      ],
      "verdictNote": "当前（A股35元附近）风险大于机会，等待2026年下半年业绩拐点确认后再布局。"
    },

    "002422": {
      "code": "002422",
      "market": "sz",
      "name": "科伦药业",
      "tags": ["大输液龙头", "创新药ADC", "合成生物"],
      "sourceDoc": "科伦药业投研尽调报告（深桑达A投研持仓.docx(1).pdf 内文）",
      "reportDate": "2026-08-08",
      "thesis": "『传统业务（大输液+抗生素）托底、创新业务（科伦博泰ADC）突围』双轮驱动。科伦博泰已成为全球ADC第一梯队，芦康沙妥珠单抗实现全球首例ADC+IO一线NSCLC III期成功，与默沙东合作总交易金额超110亿美元。",
      "moat": "大输液行业绝对龙头（2004年至今国内第一）；科伦博泰OptiDC平台；川宁生物合成生物学首批交付企业。",
      "valuation": {
        "peTtm": 46,
        "pb": 2.93,
        "fairPe": [28, 32],
        "benchmark": "医药板块平均28-32倍，行业中值38.6倍",
        "note": "当前46倍已充分反映ADC全球化+传统筑底双主题；若H2创新药放量不及预期，存在向30倍动态PE修复压力。"
      },
      "levels": {
        "entry": [38, 40],
        "addOn": [38, 40],
        "stopLoss": 40,
        "hardStop": 38,
        "target1": 52,
        "target2": 58,
        "positionLimit": 0.12
      },
      "cost": 45.44,
      "takeProfit": [
        { "level": "第一止盈位（动态）", "range": [50, 52], "note": "对应PE(TTM)约50-53倍，接近前期高点压力区；若反弹至此区间且成交量萎缩，减仓1/3" },
        { "level": "第二止盈位（乐观）", "range": [55, 58], "note": "机构目标价上沿；放量突破可再减仓1/3，保留底仓" }
      ],
      "catalysts": [
        { "time": "2025-2026H1", "event": "业绩低谷期：大输液需求回落、抗生素价格下行、创新药投入期", "amount": "-", "impact": "净利润连续大幅下滑" },
        { "time": "2026H2-2027", "event": "筑底复苏期：高端输液占比提升、创新药医保放量、抗生素营收企稳", "amount": "-", "impact": "净利润降幅收窄或转正" },
        { "time": "2027+", "event": "高增释放期：海外适应症获批、合成生物规模化、大输液结构升级完成", "amount": "-", "impact": "净利润重回中高速增长，估值切换" }
      ],
      "businessMix": [
        { "name": "大输液", "share": 40, "trend": "周期筑底", "note": "2025销量39.86亿瓶/袋、收入74.84亿元(-16.02%)；粉液双室袋+39.39%、三腔袋+30.90%逆势高增" },
        { "name": "非输液制剂", "share": 22, "trend": "集采影响趋稳", "note": "2025收入40.36亿元(-3.20%)；2026版基药目录新增35个产品（累计157个）" },
        { "name": "抗生素中间体(川宁生物)", "share": 24, "trend": "周期触底", "note": "2025收入44.97亿元(-23.20%)；Q3/Q4环比+3.40%、+8.54%触底回升" },
        { "name": "科伦博泰(创新药)", "share": 3, "trend": "爆发前夜", "note": "2025药品销售收入5.43亿元(+949.8%)；Sac-TMT国内获批4项适应症、2项已纳入医保" }
      ],
      "monitors": [
        { "dim": "业绩验证", "metric": "半年报/三季报营收与毛利率", "window": "2026-08下旬 / 10月", "bull": "营收增速转正，毛利率止跌回升", "bear": "营收继续下滑，毛利率继续下降", "weight": 10, "auto": "revenueGrowth" },
        { "dim": "创新药放量", "metric": "科伦博泰季度药品销售收入", "window": "季报", "bull": "季度环比高增、新增适应症获批", "bear": "销售不及预期、临床失败", "weight": 9, "auto": null },
        { "dim": "川宁生物", "metric": "抗生素中间体价格 / 合成生物收入", "window": "季报", "bull": "抗生素价格回升、合成生物收入放量", "bear": "价格继续下跌、产能利用率不足", "weight": 7, "auto": null },
        { "dim": "筹码/资金", "metric": "股东户数 / 融资余额", "window": "每月", "bull": "筹码集中、融资余额稳定", "bear": "散户化严重、融资大幅流出", "weight": 6, "auto": "chipConcentration" },
        { "dim": "机构评级", "metric": "券商评级与目标价", "window": "持续跟踪", "bull": "新增买入评级、目标价上调", "bear": "评级下调、盈利预测下调", "weight": 6, "auto": null },
        { "dim": "大股东/管理层", "metric": "增减持与回购", "window": "公告", "bull": "增持或回购", "bear": "大股东减持、高管离职", "weight": 6, "auto": null },
        { "dim": "估值", "metric": "PE(TTM)分位", "window": "每日", "bull": "回落至35倍以下（安全边际提升）", "bear": "突破50倍（透支预期）", "weight": 7, "auto": "valuationPE" }
      ],
      "fundamentals": {
        "revenue2025": "185.13亿元(-15.13%)",
        "netProfit2025": "17.02亿元(-42.03%)",
        "revenueQ1_2026": "42.59亿元(-2.98%)",
        "netProfitQ1_2026": "4.54亿元(-22.34%)",
        "grossMargin2025": "47.85%(-3.84pct)",
        "grossMarginQ1_2026": "45.31%(-6.89pct)",
        "cashFlow2025": "经营现金流净额26.42亿元(-41.19%)",
        "cashFlowQ1_2026": "2.5亿元(-44.45%)",
        "roe": "7.24%（2025）",
        "debtRatio": "27.70%",
        "receivables": "应收账款/利润比值达274.58%",
        "consensus2026": "东吴证券预测2026年EPS 1.21元；机构预期净利润18.14亿元"
      },
      "chips": "股东户数约7.04万户（2026-03），较上期减少1.37%，人均流通股16154股(+1.39%)，筹码略有集中。融资余额约9.4亿元，杠杆资金参与度高；8月7日大涨6.89%成交20.18亿元、换手3.49%。评级：短线博弈资金活跃，长线资金尚未稳固锁定。",
      "risks": [
        "大输液需求持续萎缩：医保控费、门诊输液限制、传染病发病率下降",
        "集采降价压力：仿制药利润空间持续压缩",
        "川宁生物周期波动：抗生素中间体价格受全球供需影响",
        "科伦博泰盈利不确定性：销售绝对值仍小(5.43亿)，研发费用高企",
        "应收账款高企：应收/利润比值274.58%，回款风险",
        "治理讨论：董事长个人IP过度绑定"
      ],
      "verdictNote": "45.44元成本处于盈亏平衡带，向上需2026H2业绩验证，向下面临估值回调与业绩恶化双重压力。建议『谨慎持有+严格止盈止损』，仓位控制在总资产8%-12%。"
    },

    "000032": {
      "code": "000032",
      "market": "sz",
      "name": "深桑达A",
      "tags": ["信创", "云计算", "中国电子系"],
      "sourceDoc": "文件名标注“深桑达A投研持仓”，但PDF正文为科伦药业内容（模板沿用）",
      "profileQuality": "low",
      "reportDate": null,
      "thesis": "【待完善】该标的画像尚未从投研文档中提取到有效内容——所提供 PDF 文件名为『深桑达A投研持仓』，但正文实为科伦药业（002422）的尽调报告。当前按通用模板生成监控规则，建议补充该股专项研报后回填画像。",
      "moat": "【待补充】",
      "valuation": { "peTtm": null, "pb": null, "fairPe": [25, 40], "benchmark": "行业均值", "note": "画像缺失，估值判断以实时PE与行业分位为准。" },
      "levels": { "entry": null, "addOn": null, "stopLoss": null, "hardStop": null, "target1": null, "target2": null, "positionLimit": 0.08 },
      "cost": null,
      "catalysts": [
        { "time": "待补充", "event": "需补充该股业务与订单节点", "amount": "-", "impact": "-" }
      ],
      "businessMix": [],
      "monitors": [
        { "dim": "估值", "metric": "PE(TTM)分位", "window": "每日", "bull": "回落至行业均值下方", "bear": "显著高于行业均值", "weight": 7, "auto": "valuationPE" },
        { "dim": "筹码结构", "metric": "股东户数变化", "window": "每月", "bull": "筹码集中", "bear": "散户化严重", "weight": 6, "auto": "chipConcentration" },
        { "dim": "业绩验证", "metric": "季报营收与毛利率", "window": "季报", "bull": "营收增速转正、毛利率回升", "bear": "营收下滑、毛利率下降", "weight": 9, "auto": "revenueGrowth" },
        { "dim": "机构评级", "metric": "券商评级与目标价", "window": "持续跟踪", "bull": "新增买入评级、目标价上调", "bear": "评级下调", "weight": 6, "auto": null }
      ],
      "fundamentals": {},
      "chips": "【待补充】",
      "risks": ["画像缺失：本标的未从投研文档中提取到有效基本面信息，策略建议仅供参考"],
      "verdictNote": "画像缺失，仅依据实时技术与估值数据给出信号，建议补充专项研报。"
    }
  }
}
;

/* ===== lib/config.js ===== */
__define('config', function (module, exports, require) {
'use strict';
/**
 * 凭据与运行配置的唯一入口。
 *
 * 三条铁律：
 *   1. 源码里绝不出现任何密钥字面量 —— 一切敏感值只从服务端环境变量读取；
 *   2. 任何读取密钥的代码必须包在 `@node-only` 区块内，打包成浏览器产物时会被整段剥离；
 *   3. 浏览器侧一律拿到空字符串，静态产物里不存在凭据，也就无从"扒取"。
 *
 * 新增密钥的流程：在 .env.example 里加一行说明 → 在 SECRETS 登记表里登记 → 业务代码用 secret('名称') 取。
 */
const IS_NODE = typeof process !== 'undefined' && !!(process.versions && process.versions.node);


/**
 * 密钥登记表。name → 说明。
 * 登记的意义：启动时能审计"哪些密钥已配置"，日志里能统一脱敏，扫描脚本也知道该盯哪些名字。
 */
const SECRETS = {
  EASTMONEY_TOKEN: '东方财富股票联想接口 token（可选）。仅服务端使用；不配置则搜索走腾讯 smartbox，无需任何凭据。'
};

/** 读取环境变量。浏览器端恒返回空串，绝不回落到任何硬编码默认值。 */
function readEnv(name) {
  return '';
}

/** 取一个密钥。禁止给敏感项传 fallback —— 缺失就应该显式降级，而不是用一个人的 key 兜底给所有人。 */
function secret(name) {
  if (!(name in SECRETS)) {
    throw new Error(`[config] 未登记的密钥 "${name}"：请先在 lib/config.js 的 SECRETS 中登记`);
  }
  return readEnv(name).trim();
}

function hasSecret(name) { return secret(name).length > 0; }

/** 取普通配置项（非敏感），可以有安全的默认值。 */
function option(name, fallback) {
  const v = readEnv(name);
  return v === '' ? fallback : v;
}
function num(name, fallback) {
  const v = parseFloat(readEnv(name));
  return Number.isFinite(v) ? v : fallback;
}
function flag(name, fallback = false) {
  const v = readEnv(name).toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return fallback;
}

/** 脱敏，仅用于日志/界面展示。永远不要直接把密钥打进日志。 */
function redact(value) {
  const s = String(value == null ? '' : value);
  if (!s) return '(空)';
  if (s.length <= 8) return s[0] + '*'.repeat(Math.max(1, s.length - 1));
  return `${s.slice(0, 4)}${'*'.repeat(Math.min(12, s.length - 6))}${s.slice(-2)}`;
}

/** 启动审计：只输出"是否已配置"，绝不输出值。 */
function audit() {
  const names = Object.keys(SECRETS);
  if (!names.length) return { registered: 0, configured: [], missing: [] };
  const configured = [], missing = [];
  for (const n of names) (hasSecret(n) ? configured : missing).push(n);
  return { registered: names.length, configured, missing };
}

module.exports = { IS_NODE, IS_BROWSER: !IS_NODE, SECRETS, secret, hasSecret, option, num, flag, redact, audit };

});

/* ===== lib/source.js ===== */
__define('source', function (module, exports, require) {
'use strict';
/**
 * 多源行情数据层（同构：Node 服务端 + 浏览器静态版通用）
 * 主源：腾讯财经（qt.gtimg.cn / web.ifzq.gtimg.cn / proxy.finance.qq.com）—— 均已开放 CORS
 * 备源：新浪财经 hq.sinajs.cn、东方财富（仅 Node 可用，无 CORS）
 * 内置 TTL 缓存，避免高频轮询触发限流。
 */
const IS_NODE = typeof process !== 'undefined' && !!(process.versions && process.versions.node);
const cfg = require('config');


const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/* ------------------------------------------------------------------ */
/* 基础请求                                                            */
/* ------------------------------------------------------------------ */
function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`timeout${label ? ' ' + label : ''}`)), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function request(url, { headers = {}, timeout = 9000 } = {}) {
  const h = { 'User-Agent': UA, 'Accept': '*/*', ...headers };

  // ---- 浏览器：直接 fetch（腾讯行情接口已开放 access-control-allow-origin: *）----
  if (!IS_NODE) {
    return withTimeout(
      fetch(url, { headers: h, referrerPolicy: 'no-referrer', mode: 'cors' }).then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} @ ${url.slice(0, 90)}`);
        return new Uint8Array(await res.arrayBuffer());
      }),
      timeout, `@ ${url.slice(0, 60)}`
    );
  }

  // ---- Node：原生 https（@node-only，不会进入浏览器产物）----

  return Promise.reject(new Error('request(): 当前环境无可用传输层'));
}

const gbk = (buf) => new TextDecoder('gbk').decode(buf);
const utf8 = (buf) => new TextDecoder('utf-8').decode(buf);

/* ------------------------------------------------------------------ */
/* 缓存                                                                */
/* ------------------------------------------------------------------ */
const cache = new Map();
async function cached(key, ttl, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < ttl) return hit.v;
  const v = await fn();
  cache.set(key, { t: Date.now(), v });
  return v;
}

/* ------------------------------------------------------------------ */
/* 代码规范化                                                          */
/* ------------------------------------------------------------------ */
function normalize(code) {
  const c = String(code).trim().toUpperCase().replace(/^(SH|SZ|BJ)\.?/, '');
  let market;
  if (/^6\d{5}$/.test(c) || /^5\d{5}$/.test(c) || /^9\d{5}$/.test(c)) market = 'sh';
  else if (/^[03]\d{5}$/.test(c) || /^1\d{5}$/.test(c)) market = 'sz';
  else if (/^[48]\d{5}$/.test(c)) market = 'bj';
  else market = null;
  return { code: c, market, secid: market ? `${market === 'sh' ? 1 : market === 'bj' ? 0 : 0}.${c}` : null, tx: market ? `${market}${c}` : null };
}

/* ------------------------------------------------------------------ */
/* 1. 实时快照                                                         */
/* ------------------------------------------------------------------ */
/**
 * 腾讯快照字段索引（v_xxx="..." 以 ~ 分隔）
 * 3 现价 | 4 昨收 | 5 今开 | 6 成交量(手) | 7 外盘 | 8 内盘
 * 9-28 五档 | 30 时间 | 31 涨跌 | 32 涨跌% | 33 最高 | 34 最低
 * 37 成交额(万) | 38 换手% | 39 PE(TTM) | 43 振幅% | 44 流通市值(亿)
 * 45 总市值(亿) | 46 PB | 47 涨停 | 48 跌停 | 49 量比 | 51 均价 | 52 PE(动)
 */
function parseTencentSnapshot(text) {
  const out = [];
  const re = /v_([a-z]{2}\d{6})="([^"]*)"/g;
  let m;
  while ((m = re.exec(text))) {
    const tx = m[1];
    const f = m[2].split('~');
    if (f.length < 50 || !f[1]) continue;
    const n = (i) => { const x = parseFloat(f[i]); return Number.isFinite(x) ? x : null; };
    out.push({
      code: f[2], market: tx.slice(0, 2), name: f[1],
      price: n(3), preClose: n(4), open: n(5),
      volume: n(6), outer: n(7), inner: n(8),
      time: f[30] ? `${f[30].slice(0, 4)}-${f[30].slice(4, 6)}-${f[30].slice(6, 8)} ${f[30].slice(8, 10)}:${f[30].slice(10, 12)}:${f[30].slice(12, 14)}` : '',
      change: n(31), changePct: n(32), high: n(33), low: n(34),
      amount: n(37) != null ? n(37) * 10000 : null,   // 元
      turnover: n(38), peTtm: n(39), amplitude: n(43),
      floatCap: n(44), totalCap: n(45), pb: n(46),
      limitUp: n(47), limitDown: n(48), volumeRatio: n(49),
      avgPrice: n(51), peDynamic: n(52), peStatic: n(53),
      bids: Array.from({ length: 5 }, (_, i) => ({ p: n(9 + i * 2), v: n(10 + i * 2) })),
      asks: Array.from({ length: 5 }, (_, i) => ({ p: n(19 + i * 2), v: n(20 + i * 2) })),
      source: 'tencent'
    });
  }
  return out;
}

function parseSinaSnapshot(text) {
  const out = [];
  const re = /hq_str_([a-z]{2}\d{6})="([^"]*)"/g;
  let m;
  while ((m = re.exec(text))) {
    const f = m[2].split(',');
    if (f.length < 32 || !f[0]) continue;
    const n = (i) => { const x = parseFloat(f[i]); return Number.isFinite(x) ? x : null; };
    const preClose = n(2), price = n(3);
    out.push({
      code: m[1].slice(2), market: m[1].slice(0, 2), name: f[0],
      price, preClose, open: n(1), high: n(4), low: n(5),
      volume: n(8), amount: n(9),
      change: price != null && preClose ? +(price - preClose).toFixed(3) : null,
      changePct: price != null && preClose ? +(((price - preClose) / preClose) * 100).toFixed(2) : null,
      time: `${f[30]} ${f[31]}`,
      turnover: null, peTtm: null, pb: null, volumeRatio: null,
      source: 'sina'
    });
  }
  return out;
}

async function getQuotes(codes) {
  const list = codes.map(normalize).filter((c) => c.tx);
  if (!list.length) return {};
  const txParam = list.map((c) => c.tx).join(',');
  let rows = [];
  try {
    const buf = await cached(`tx-snap:${txParam}`, 4000, () => request(`https://qt.gtimg.cn/q=${txParam}`));
    rows = parseTencentSnapshot(gbk(buf));
  } catch (e) {
    console.warn('[source] 腾讯快照失败，降级新浪：', e.message);
    const buf = await cached(`sina-snap:${txParam}`, 4000, () =>
      request(`https://hq.sinajs.cn/list=${txParam}`, { headers: { Referer: 'https://finance.sina.com.cn' } }));
    rows = parseSinaSnapshot(gbk(buf));
  }
  const map = {};
  rows.forEach((r) => { map[r.code] = r; });
  return map;
}

async function getQuote(code) {
  const map = await getQuotes([code]);
  return map[normalize(code).code] || null;
}

/* ------------------------------------------------------------------ */
/* 2. K 线                                                             */
/* ------------------------------------------------------------------ */
/** period: day | week | month */
async function getKline(code, period = 'day', count = 260) {
  const { code: c, tx } = normalize(code);
  const p = ['day', 'week', 'month'].includes(period) ? period : 'day';
  const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${tx},${p},,,${count},qfq`;
  const buf = await cached(`k-${tx}-${p}-${count}`, 60000, () => request(url));
  const json = JSON.parse(utf8(buf));
  const node = json?.data?.[tx];
  if (!node) throw new Error(`无K线数据: ${code}`);
  const rows = node[`qfq${p}`] || node[p] || [];
  return rows.map((r) => ({
    date: r[0], open: +r[1], close: +r[2], high: +r[3], low: +r[4], volume: +r[5],
    amount: r[6] != null ? +r[6] : null
  })).filter((r) => Number.isFinite(r.close));
}

/* ------------------------------------------------------------------ */
/* 3. 分时                                                             */
/* ------------------------------------------------------------------ */
async function getMinutes(code) {
  const { tx } = normalize(code);
  const url = `https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=${tx}`;
  const buf = await cached(`min-${tx}`, 15000, () => request(url));
  const json = JSON.parse(utf8(buf));
  const node = json?.data?.[tx];
  const preClose = +(node?.qt?.[tx]?.[4] ?? 0);
  const raw = node?.data?.data || [];
  const ticks = raw.map((line) => {
    const [t, price, vol, amt] = line.split(' ');
    return {
      time: `${t.slice(0, 2)}:${t.slice(2, 4)}`,
      price: +price, volume: +vol, amount: +amt
    };
  });
  return { preClose, ticks };
}

/* ------------------------------------------------------------------ */
/* 4. 资金流（分时主动买卖推算，第三方接口不可用时兜底）              */
/* ------------------------------------------------------------------ */
const fflowCache = new Map();
async function getFundFlow(code) {
  const { code: c, market, secid } = normalize(code);
  const key = `ff-${c}`;
  const hit = fflowCache.get(key);
  if (hit && Date.now() - hit.t < 60000) return hit.v;

  // 尝试东方财富（精确主力净流入）—— 该接口未开放 CORS，浏览器环境直接走分时估算
  let result = null;

  // 兜底：分时量价推算主动买卖（注意：腾讯分时的成交量/成交额为【累计值】，需先差分）
  if (!result) {
    try {
      const { ticks, preClose } = await getMinutes(code);
      let buy = 0, sell = 0, flat = 0;
      let prevVol = 0, prev = preClose || ticks[0]?.price || 0;
      for (const t of ticks) {
        const dv = Math.max(0, t.volume - prevVol);   // 本分钟增量（手）
        prevVol = t.volume;
        if (t.price > prev) buy += dv;
        else if (t.price < prev) sell += dv;
        else flat += dv;
        prev = t.price;
      }
      const avg = ticks.length ? ticks.reduce((s, t) => s + t.price, 0) / ticks.length : 0;
      const main = Math.round((buy - sell) * avg * 100);   // 元
      const total = buy + sell + flat || 1;
      result = {
        source: 'estimate',
        note: '基于分时逐分钟量价的主动买卖估算（第三方资金流接口不可用时启用）',
        today: {
          date: '', main, buyVolume: buy, sellVolume: sell, flatVolume: flat,
          avgPrice: +avg.toFixed(2), buyRatio: +((buy / total) * 100).toFixed(1)
        },
        series: [{ date: '', main }]
      };
    } catch (_) {
      result = { source: 'none', today: null, series: [] };
    }
  }
  fflowCache.set(key, { t: Date.now(), v: result });
  return result;
}

/* ------------------------------------------------------------------ */
/* 5. 股票搜索                                                         */
/* ------------------------------------------------------------------ */
/** 腾讯 smartbox 联想（JSONP，绕过 CORS；返回值形如 v_hint="sz~002422~科伦药业~klyy~GP-A^..."） */
function parseSmartbox(raw) {
  if (!raw || typeof raw !== 'string') return [];
  return raw.split('^').map((item) => {
    const f = item.split('~');
    if (f.length < 5) return null;
    const [mk, code, name, , type] = f;
    if (!['sh', 'sz', 'bj'].includes(mk)) return null;          // 只保留 A 股市场
    if (!/^GP/.test(type || '')) return null;                    // 只保留股票（排除基金/债券）
    return { code, name, market: mk, secid: `${mk === 'sh' ? 1 : 0}.${code}`, type: 'A股' };
  }).filter(Boolean);
}

function jsonpSuggest(keyword, timeout = 4000) {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve([]);
    const s = document.createElement('script');
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      const raw = window.v_hint || '';
      try { delete window.v_hint; } catch (_) { window.v_hint = undefined; }
      s.remove();
      resolve(parseSmartbox(raw));
    };
    s.onload = finish;
    s.onerror = finish;
    s.src = `https://smartbox.gtimg.cn/s3/?v=2&t=all&q=${encodeURIComponent(keyword)}&_=${Date.now()}`;
    document.head.appendChild(s);
    setTimeout(finish, timeout);
  });
}

/**
 * 从 smartbox 原始响应中解出 v_hint 的内层值，再交给 parseSmartbox。
 * Node 端拿到的是完整文本 `v_hint="sz~002422~..."`；浏览器 JSONP 拿到的已是内层值。
 */
function parseSmartboxText(text) {
  const s = String(text || '');
  const m = s.match(/v_hint\s*=\s*"([^"]*)"/);
  return parseSmartbox(m ? m[1] : s);
}

/**
 * 腾讯 smartbox 联想搜索（默认路径，无需任何凭据）。
 * Node 端直接 HTTP 抓取并按 GBK 解码；浏览器端走 JSONP 绕过 CORS。
 * 两端共用同一个 parseSmartbox，行为一致。
 */
async function smartboxSuggest(kw) {
  const url = `https://smartbox.gtimg.cn/s3/?v=2&t=all&q=${encodeURIComponent(kw)}&_=${Date.now()}`;
  return jsonpSuggest(kw);
}

async function searchStocks(keyword) {
  const kw = String(keyword || '').trim();
  if (!kw) return [];

  // 可选的增强路径：服务端另行配置了东方财富 token 时才启用（字段更全）。
  // 该分支整体位于 @node-only 区块内，打包成浏览器产物时会被剥离，token 不可能进入静态文件。

  const rows = await smartboxSuggest(kw);
  if (rows.length) return rows;

  // 最终兜底：能识别成 6 位代码就直接用
  const n = normalize(kw);
  return n.market ? [{ code: n.code, name: n.code, market: n.market, secid: n.secid, type: 'A股' }] : [];
}

module.exports = {
  request, getQuotes, getQuote, getKline, getMinutes, getFundFlow, searchStocks,
  normalize, cached, gbk, utf8, parseSmartbox, parseSmartboxText, smartboxSuggest, IS_NODE
};

});

/* ===== lib/tech.js ===== */
__define('tech', function (module, exports, require) {
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

});

/* ===== lib/monitors.js ===== */
__define('monitors', function (module, exports, require) {
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

});

/* ===== lib/portrait.js ===== */
__define('portrait', function (module, exports, require) {
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
const monitors = require('monitors');

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

});

/* ===== lib/rules.js ===== */
__define('rules', function (module, exports, require) {
'use strict';
/**
 * 信号规则引擎
 * 两类规则：
 *  A. 通用技术规则 —— 适用于任意标的，由实时行情 + K线推导
 *  B. 个股画像规则 —— 从投研文档提取的关键价位/估值/监控清单
 * 每条信号输出：方向 / 强度 / 权重 / 结论文本 / 数据依据
 *
 * 注：监控清单的求值已收敛到 lib/monitors.js 的统一脚手架，
 *    本文件只保留「技术规则 / 通道规则 / 画像价位规则」。
 */
const monitors = require('monitors');

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
  /* 自动画像的价位是由现价反推出来的，不是研报给的。
     若让它们参与画像价位规则，止损/目标位会与现价"贴脸"，
     凭空产生「逼近止损位」「接近目标位」这类假信号 —— 因此整体跳过。 */
  const L = profile.auto ? {} : (profile.levels || {});

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

  /* --- 监控清单的可自动判定项 ---
     已迁移到 lib/monitors.js 的 evaluate()：专项清单与通用清单走同一套求值器，
     并显式区分「已实现」与「口径已声明但缺数据源（pending）」两种情况。 */

  return s;
}

/* ================================================================== */
/* C. 通用监控清单（无画像标的的兜底）                                  */
/* ================================================================== */
/**
 * 没有专项研报画像时，用实时技术状态生成一套等价的盯盘清单。
 *
 * 定义与求值已收敛到 lib/monitors.js 的脚手架：
 *   · buildGeneric(ctx) 给出「看什么 / 什么算好 / 什么算坏」的口径；
 *   · EVALUATORS        给出每一项的自动判定，把清单从"只展示"变成"可触发信号"；
 *   · PENDING_KEYS      显式登记"口径已声明、但当前数据源给不出判定"的项，
 *                       标记为 pending 待复核，而不是静默永不触发。
 *
 * 这里保留一个薄封装，兼容既有调用方。
 */
function genericMonitors(ctx) {
  return monitors.buildGeneric(ctx);
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

});

/* ===== lib/report.js ===== */
__define('report', function (module, exports, require) {
'use strict';
/**
 * 投研报告 / 持仓攻略 自动生成器
 * 完全模仿《中兴投研持仓攻略》与《科伦药业投研尽调报告》的 8 章结构与行文逻辑，
 * 对任意标的输出同构报告：实时盯盘结论 + 基本面框架 + 监控清单 + 操作纪律。
 */
const profilesData = require('profiles');

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

/** 清单项的判定状态 → 报告里的文字 */
const MON_STATE_TEXT = {
  bull: '🔴 看多', bear: '🟢 看空', neutral: '⚪ 中性',
  pending: '⏸ 待复核', manual: '✎ 人工跟踪',
  inapplicable: '— 不适用', na: '— 数据不足'
};

function monitorTable(monitors, source, summary) {
  if (!monitors?.length) return '_暂无可用的监控项（行情数据不足）。_';
  const srcNote = source === 'profile'
    ? '清单来源：**专项清单**（来自投研文档）'
    : '清单来源：**自动清单**（由实时行情派生，非投研结论）';
  const head = ['| 跟踪维度 | 关键指标 | 观察窗口 | 利好信号 | 利空信号 | 判定 | 当前状态 | 权重 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |'];
  const rows = monitors.map((m) =>
    `| ${m.dim} | ${m.metric} | ${m.window} | 🔴 ${m.bull} | 🟢 ${m.bear} `
    + `| ${MON_STATE_TEXT[m.state] || '—'} | ${m.note || '—'} | ${m.weight} |`);
  const out = [`> ${srcNote}`, '', ...head, ...rows].join('\n');
  if (!summary) return out;
  const tail = `**清单概览：** ${summary.verdict}（可判定 ${summary.judgeable} / 列出 ${summary.listed} 项）`
    + (summary.gapNote ? `\n\n> ${summary.gapNote}` : '');
  return `${out}\n\n${tail}`;
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
  if (hasProfile) {
    L.push(pf.auto
      ? '> **画像来源：** ⚠️ **自动画像** —— 由实时行情与 K 线自动生成，**不是投研报告**，不含基本面判断与机构观点。'
      : `> **画像来源：** ${pf.sourceDoc}${pf.reportDate ? `（原报告日期 ${pf.reportDate}）` : ''}`);
  }
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
  L.push(`- **策略面评分：** ${scores.profile != null ? `${scores.profile} / 100` : '（无投研画像，本项不计入）'}`);
  L.push(`- **监控面评分：** ${scores.monitor != null ? `${scores.monitor} / 100（自动清单逐项判定汇总）` : '（无）'}`);
  L.push(`- **权重：** ${scores.profile != null
    ? `技术面 × ${pf?.profileQuality === 'high' ? '45%' : '75%'} + 策略面 × 其余`
    : scores.monitor != null ? '技术面 × 60% + 监控面 × 40%' : '仅技术面'}`);
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
  if (hasProfile && !pf.auto && pf.fundamentals && Object.keys(pf.fundamentals).length) {
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
  } else if (pf?.auto) {
    /* 自动画像没有财务数据源 —— 如实说明，不臆造营收/利润/毛利率 */
    L.push('**1. 财务基本面**：_自动画像不提供财务基本面 —— 系统未接入定期报告数据，'
      + '不会臆造营收、净利润或毛利率。以下为实时行情快照。_');
    L.push('');
    L.push('| 行情指标 | 当前数值 |');
    L.push('| --- | --- |');
    const F = pf.fundamentals || {};
    const label = {
      peTtm: '市盈率 PE(TTM)', pb: '市净率 PB',
      totalCap: '总市值（亿元）', floatCap: '流通市值（亿元）',
      turnover: '换手率（%）', volumeRatio: '量比',
      position52: '52周区间位置（%）', drawdownFromHigh: '距52周高点（%）',
      atrPct: 'ATR 日均波动率（%）'
    };
    Object.entries(F)
      .filter(([k, v]) => k !== 'source' && v != null && v !== '')
      .forEach(([k, v]) => L.push(`| ${label[k] || k} | ${v} |`));
    L.push(`| 数据源 | ${F.source || '实时行情'} |`);
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
  const peJudge = q.peTtm == null ? '—'
    : q.peTtm <= 0 ? '公司当前亏损，PE 不适用，需改用 PB 或 PS 判断'
      : refLow != null
        ? (q.peTtm < refLow ? '低于合理区间，安全边际抬升' : q.peTtm > refHigh ? '高于合理区间，估值透支风险' : '处于合理区间，估值中性')
        : '未提供参照区间，不做分位判断';
  L.push(`| 市盈率 PE(TTM) | ${q.peTtm ?? '—'} 倍 | ${refLow ? `${refLow}-${refHigh} 倍` : '—（未提供）'} | ${peJudge} |`);
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
  if (a.monitorsSource === 'auto') {
    L.push('> 该标的尚未导入专项研报画像，以下为**自动清单**：由实时指标派生，'
      + '每一项都带自动判定口径，判定为「看多 / 看空」的项会**实际参与综合评分**（监控面），'
      + '不再只是展示。导入该股研报后会自动切换为专项清单。');
    L.push('');
  }
  L.push(monitorTable(a.monitors || pf?.monitors, a.monitorsSource, a.monitorSummary));
  L.push('');

  L.push(`### 4. 实时信号明细（${signals.all.length} 条）`);
  L.push('');
  L.push(signalTable(signals.all.slice(0, 24)));
  L.push('');

  L.push('---');
  L.push('');
  L.push(`*本报告由 StockSentry 智能盯盘系统于 ${now.toLocaleString('zh-CN')} 自动生成。行情与轨道类指标数据来自腾讯财经公开接口（成交额口径为人民币），`
    + (pf?.auto
      ? '该标的未导入投研文档，画像与监控清单均由实时行情与 K 线自动派生，不含基本面与机构观点。'
      : `财务与业务数据来自用户提供的投研文档（${hasProfile ? pf.sourceDoc : '未提供'}）。`)
    + `技术指标均为公开算法统计口径，可自行复算验证。*`);
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

});

/* ===== lib/engine.js ===== */
__define('engine', function (module, exports, require) {
'use strict';
/**
 * 分析引擎：把行情、指标、信号、画像合成为「入场/离场」明确结论
 */
const src = require('source');
const tech = require('tech');
const rules = require('rules');
const monitors = require('monitors');
const portrait = require('portrait');
const profilesData = require('profiles');

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

  /* 支撑/阻力与价位兜底的推导统一收敛到 portrait.deriveLevels，
     避免同一套「ATR + 关键位」逻辑在引擎与画像里各写一遍而产生口径漂移 */
  const d = portrait.deriveLevels(ind);
  const supports = d.supports;
  const resistances = d.resistances;

  const entryLo = L.entry?.[0] ?? d.entry[0];
  const entryHi = L.entry?.[1] ?? d.entry[1];
  const stopLoss = L.stopLoss ?? d.stopLoss;
  const hardStop = L.hardStop ?? d.hardStop;
  // 目标位已在 deriveLevels 内保证与现价保持 ≥1.2×ATR 距离，避免"贴脸"导致盈亏比失真
  const target1 = L.target1 ?? d.target1;
  let target2 = L.target2 ?? d.target2;
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
  const wTech = quality === 'high' ? 0.45 : quality === 'low' ? 0.75 : 1;

  let composite;
  if (profileScore != null) {
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

});

window.SentryLib = {
  config: __require('config'),
  source: __require('source'),
  tech: __require('tech'),
  monitors: __require('monitors'),
  portrait: __require('portrait'),
  rules: __require('rules'),
  report: __require('report'),
  engine: __require('engine'),
  profiles: PROFILES_DATA,
  IS_NODE: false
};
})();
