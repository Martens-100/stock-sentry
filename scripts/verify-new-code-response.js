'use strict';
/**
 * 新代码响应验证 —— 输入不在画像库的代码时，系统到底产出什么。
 *
 * 画像库仅覆盖 3 只：000063 中兴通讯 / 002422 科伦药业 / 000032 深桑达A。
 * 本脚本对三只**不在库中**的股票跑完整 analyze()，逐项核对产出是否真实、完整、且来源标注诚实。
 *
 * 字段路径依据实际返回结构校正（analyze 返回 scores/monitors/monitorSummary/ind.channelVerdict 等，
 * 顶层没有 composite/techScore —— 早期版本按顶层取会全为 undefined，是脚本的错不是系统的错）。
 *
 * 用法：node scripts/verify-new-code-response.js
 */
const engine = require('../lib/engine.js');
const report = require('../lib/report.js');
const monitorsLib = require('../lib/monitors.js');

const NEW_CODES = ['600519', '000001', '002594'];   // 贵州茅台 / 平安银行 / 比亚迪，均不在画像库
const IN_LIB = '002422';                            // 对照组：在画像库

const line = (t) => console.log('\n' + '─'.repeat(74) + '\n  ' + t + '\n' + '─'.repeat(74));
const nz = (v, d = '—') => (v == null ? d : v);

function summarize(a) {
  const s = a.scores || {};
  const sig = a.signals || {};
  const byOrigin = {};
  (sig.all || []).forEach((x) => { byOrigin[x.origin] = (byOrigin[x.origin] || 0) + 1; });

  const rows = Array.isArray(a.monitors) ? a.monitors : [];
  const states = {};
  rows.forEach((r) => { states[r.state || 'unknown'] = (states[r.state || 'unknown'] || 0) + 1; });
  const withEvidence = rows.filter((r) => r.evidence).length;

  const cv = (a.ind && a.ind.channelVerdict) || {};

  return {
    code: a.code, name: a.name,
    price: a.quote && a.quote.price,
    composite: s.composite, technical: s.technical, profile: s.profile, monitor: s.monitor,
    action: a.action && a.action.label,
    isAuto: !!(a.profile && a.profile.auto),
    quality: a.profile && a.profile.profileQuality,
    levelsSource: a.plan && a.plan.levelsSource,
    entry: a.plan && a.plan.entry,
    stopLoss: a.plan && a.plan.stopLoss,
    hardStop: a.plan && a.plan.hardStop,
    target1: a.plan && a.plan.target1,
    target2: a.plan && a.plan.target2,
    riskReward: a.plan && a.plan.riskReward,
    batches: (a.plan && a.plan.batches && a.plan.batches.length) || 0,
    supports: (a.plan && a.plan.supports && a.plan.supports.length) || 0,
    resistances: (a.plan && a.plan.resistances && a.plan.resistances.length) || 0,
    monitorRows: rows.length,
    monitorStates: states,
    monitorWithEvidence: withEvidence,
    monitorSummary: a.monitorSummary,
    monitorsSource: a.monitorsSource,
    railDir: cv.railDirLabel, zone: cv.zone, bollLabel: cv.bollLabel,
    signalsTotal: (sig.all || []).length, byOrigin,
    klineBars: (a.chart && a.chart.kline && a.chart.kline.length) || 0,
    hasRails: !!(a.chart && a.chart.rails && a.chart.rails.up),
    hasBoll: !!(a.chart && a.chart.boll && a.chart.boll.up),
  };
}

function show(s) {
  console.log('  ' + (s.isAuto ? '【自动画像】' : '【投研画像】') + '  ' + s.code + ' ' + s.name
    + '   现价 ' + nz(s.price) + '   结论 ' + nz(s.action));
  console.log('');
  console.log('  评分：综合 ' + nz(s.composite) + ' = 技术面 ' + nz(s.technical)
    + ' / 策略面 ' + nz(s.profile) + ' / 监控面 ' + nz(s.monitor));
  console.log('  价位：来源 ' + s.levelsSource
    + (s.levelsSource === 'derived' ? '（ATR 推算，非研报）' : '（投研画像）'));
  console.log('        建仓 ' + (s.entry ? s.entry.join(' ~ ') : '—')
    + '   止损 ' + nz(s.stopLoss) + ' / 硬 ' + nz(s.hardStop)
    + '   目标 ' + nz(s.target1) + ' / ' + nz(s.target2)
    + '   盈亏比 ' + nz(s.riskReward));
  console.log('        分批 ' + s.batches + ' 档   支撑 ' + s.supports + ' 个   阻力 ' + s.resistances + ' 个');
  console.log('  信号：' + s.signalsTotal + ' 条  ' + JSON.stringify(s.byOrigin));
  console.log('  监控：' + s.monitorRows + ' 行（来源 ' + s.monitorsSource + '）'
    + '   状态 ' + JSON.stringify(s.monitorStates)
    + '   带证据 ' + s.monitorWithEvidence + '/' + s.monitorRows);
  console.log('  图表：K线 ' + s.klineBars + ' 根   导轨载荷 ' + (s.hasRails ? '有' : '无')
    + '   布林载荷 ' + (s.hasBoll ? '有' : '无'));
  console.log('  轨道：' + nz(s.railDir) + ' · ' + nz(s.bollLabel));
  console.log('        研判：' + nz(s.zone));
}

(async () => {
  console.log('\n' + '='.repeat(74));
  console.log('  新代码响应验证 —— 输入不在画像库的代码，系统产出什么');
  console.log('  画像库覆盖：000063 / 002422 / 000032（共 3 只）');
  console.log('='.repeat(74));

  const results = [];
  for (const code of [...NEW_CODES, IN_LIB]) {
    line('analyze(' + code + ')');
    try {
      const a = await engine.analyze(code);
      const s = summarize(a);
      results.push(s);
      show(s);
    } catch (e) {
      console.log('  ✗ analyze 失败: ' + e.message);
      results.push({ code, error: e.message });
    }
  }

  /* ---------------- 断言 ---------------- */
  line('断言检查');
  let pass = 0, fail = 0;
  const check = (name, cond, extra) => {
    if (cond) { pass++; console.log('  ✅ ' + name); }
    else { fail++; console.log('  ❌ ' + name + (extra ? ' → ' + extra : '')); }
  };

  const news = results.filter((r) => NEW_CODES.includes(r.code) && !r.error);
  const lib = results.find((r) => r.code === IN_LIB && !r.error);

  check('三只新代码均完成分析', news.length === NEW_CODES.length,
        '成功 ' + news.length + '/' + NEW_CODES.length);

  if (news.length) {
    console.log('');
    console.log('  【产出完整性】');
    check('综合评分为有限数', news.every((r) => Number.isFinite(r.composite)));
    check('技术面评分为有限数', news.every((r) => Number.isFinite(r.technical)));
    check('结论动作非空', news.every((r) => !!r.action));
    check('交易计划四要素齐全（建仓/止损/目标一/目标二）',
          news.every((r) => r.entry && r.stopLoss != null && r.target1 != null && r.target2 != null));
    check('分批节奏非空', news.every((r) => r.batches > 0));
    check('至少一侧有支撑/阻力产出',
          news.every((r) => r.supports > 0 || r.resistances > 0));
    /* 单侧为空是合理行为：支撑来自低于现价的历史密集区、阻力来自高于现价的。
       价格处于 120 日区间极值时，一侧自然为空。这不该判失败，
       但应被记录下来 —— 因为 UI 需要给出解释，而不是显示空列表。 */
    const oneSided = news.filter((r) => r.supports === 0 || r.resistances === 0);
    if (oneSided.length) {
      console.log('  ⚠ 观察：' + oneSided.length + '/' + news.length + ' 只标的的支撑或阻力单侧为空');
      oneSided.forEach((r) => console.log('      ' + r.code + ' ' + r.name
        + '  支撑 ' + r.supports + ' / 阻力 ' + r.resistances
        + '（价格处于 120 日区间极值时属正常，但 UI 应给出解释）'));
    }
    check('K 线数据非空', news.every((r) => r.klineBars > 0));
    check('轨道研判非空', news.every((r) => !!r.zone));
    check('图表载荷含导轨与布林', news.every((r) => r.hasRails && r.hasBoll));

    console.log('');
    console.log('  【信号与监控】');
    check('产生技术面信号', news.every((r) => (r.byOrigin.technical || 0) > 0));
    check('产生监控面信号', news.every((r) => (r.byOrigin.monitor || 0) > 0));
    check('自动监控清单非空', news.every((r) => r.monitorRows > 0),
          '行数 ' + news.map((r) => r.code + ':' + r.monitorRows).join(' '));
    check('监控清单每行都带数据依据（evidence）',
          news.every((r) => r.monitorWithEvidence === r.monitorRows));
    check('监控清单行数与 monitorSummary.total 一致',
          news.every((r) => r.monitorSummary && r.monitorSummary.total === r.monitorRows),
          news.map((r) => r.code + ':' + r.monitorRows + ' vs ' + (r.monitorSummary && r.monitorSummary.total)).join(' '));

    console.log('');
    console.log('  【来源标注诚实性】');
    check('新代码标记为自动画像', news.every((r) => r.isAuto === true));
    check('新代码 quality 为 auto', news.every((r) => r.quality === 'auto'));
    check('新代码价位来源为 derived（不冒充研报）',
          news.every((r) => r.levelsSource === 'derived'));
    check('新代码监控来源为 auto', news.every((r) => r.monitorsSource === 'auto'));
    check('新代码策略面为 null（不编造投研结论）',
          news.every((r) => r.profile == null));
  }

  if (lib) {
    console.log('');
    console.log('  【对照组：画像库内标的】');
    check('走投研画像路径', lib.isAuto === false);
    check('价位来源为 profile', lib.levelsSource === 'profile');
    check('监控来源为 profile', lib.monitorsSource === 'profile');
    check('策略面评分非空', Number.isFinite(lib.profile));
  }

  /* ---------------- 报告产出 ---------------- */
  line('报告产出检查');
  for (const code of ['600519', IN_LIB]) {
    try {
      const a = await engine.analyze(code);
      /* buildReport 返回 Markdown 字符串（非对象、非数组）——
         早期版本按 r.markdown 取值会落空，是脚本的错。 */
      const raw = report.buildReport(a);
      const md = Array.isArray(raw) ? raw.join('\n') : (typeof raw === 'string' ? raw : '');
      if (md) {
        const chapters = (md.match(/^##\s/gm) || []).length;
        console.log('  ' + code + '  报告 ' + md.length + ' 字符 · ' + chapters + ' 个二级章节'
          + ' · 含「自动画像」警示 ' + (/自动画像/.test(md) ? '是' : '否')
          + ' · 含派生价位说明 ' + (/ATR|推算/.test(md) ? '是' : '否'));
      } else {
        console.log('  ' + code + '  buildReport 返回类型异常: ' + typeof raw);
      }
    } catch (e) {
      console.log('  ' + code + '  报告生成失败: ' + e.message);
    }
  }

  /* ---------------- 自动清单模板 ---------------- */
  line('自动监控清单模板');
  try {
    const tpl = monitorsLib.autoTemplate ? monitorsLib.autoTemplate() : null;
    if (Array.isArray(tpl)) {
      console.log('  模板项数: ' + tpl.length);
      tpl.forEach((m) => console.log('    · ' + m.dim + '（' + m.auto + '）权重 ' + m.weight));
    } else {
      console.log('  monitors.js 导出: ' + Object.keys(monitorsLib).join(','));
    }
  } catch (e) {
    console.log('  模板读取失败: ' + e.message);
  }

  console.log('\n' + '='.repeat(74));
  console.log('  通过 ' + pass + '   失败 ' + fail);
  console.log('='.repeat(74) + '\n');
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error('异常: ' + e.stack); process.exit(1); });
