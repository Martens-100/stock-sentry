'use strict';
/**
 * 溯源契约自检
 * =============
 * 契约必须能证明两件事，缺一不可：
 *   ① **真的会拦** —— 各种不合规形态逐条被拒
 *   ② **真的会放行** —— 完整信封不被误杀
 *
 * 只测 ① 会导致误杀（把合规数据也拒了，图层全没了）；
 * 只测 ② 会导致契约形同虚设（什么都放行）。
 *
 * 用法：node scripts/verify-provenance-selftest.js
 */
const prov = require('../lib/provenance.js');

let pass = 0, fail = 0;
function t(name, cond, extra) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name + (extra ? '  → ' + extra : '')); }
}

const NOW = '2026-10-08 20:00';
const GOOD = {
  source: 'derived',
  asOf: '2026-10-08 15:00',
  computedAt: NOW,
  formula: 'MA5 = sum(close[-5:]) / 5',
  inputs: ['close'],
  window: 5,
};

console.log('\n' + '='.repeat(72));
console.log('  溯源契约自检');
console.log('='.repeat(72));

/* ---------------- ① 必须会拦 ---------------- */
console.log('\n── ① 不合规形态必须被拒 ──');

const REJECT_CASES = [
  ['未携带溯源（裸值）',           null,                                          'NO_PROVENANCE'],
  ['空对象',                       {},                                            'MISSING_FIELD'],
  ['缺 source',                    Object.assign({}, GOOD, { source: undefined }), 'MISSING_FIELD'],
  ['缺 asOf',                      Object.assign({}, GOOD, { asOf: '' }),         'MISSING_FIELD'],
  ['缺 formula',                   Object.assign({}, GOOD, { formula: null }),    'MISSING_FIELD'],
  ['inputs 为空数组',              Object.assign({}, GOOD, { inputs: [] }),       'MISSING_FIELD'],
  ['未登记的数据来源',             Object.assign({}, GOOD, { source: 'somewhere' }), 'UNKNOWN_SOURCE'],
  ['derived 但无 inputs',          Object.assign({}, GOOD, { inputs: undefined, source: 'derived' }), 'MISSING_FIELD'],
  ['数据时点晚于计算时刻',         Object.assign({}, GOOD, { asOf: '2026-10-09 10:00' }), 'ASOF_AFTER_COMPUTED'],
  ['窗口型指标未声明 window',      Object.assign({}, GOOD, { window: undefined }), 'MISSING_WINDOW'],
  ['formula 是占位符',             Object.assign({}, GOOD, { formula: 'TODO' }),   'PLACEHOLDER_FORMULA'],
];

REJECT_CASES.forEach(([name, env, expectCode]) => {
  const ctx = { path: 'chart.test', field: 'ma5' };   // 窗口型，触发 MISSING_WINDOW 检查
  const r = prov.validate(env, ctx);
  const hit = r.violations.some((v) => v.code === expectCode);
  t(name + ' → ' + expectCode, !r.ok && hit,
    '实际违规码 ' + JSON.stringify(r.violations.map((v) => v.code)));
});

/* ---------------- ② 必须会放行 ---------------- */
console.log('\n── ② 合规信封不得被误杀 ──');

{
  const r = prov.validate(GOOD, { path: 'chart.ma5', field: 'ma5' });
  t('完整信封（derived + window）通过', r.ok,
    r.ok ? '' : JSON.stringify(r.violations));

  const r2 = prov.validate(Object.assign({}, GOOD, { source: 'tencent', window: 20 }),
    { path: 'chart.kline', field: 'kline' });
  t('一手来源 + 非窗口型指标通过', r2.ok, r2.ok ? '' : JSON.stringify(r2.violations));

  const r3 = prov.validate(Object.assign({}, GOOD, { source: 'fixture', window: 60 }),
    { path: 'chart.rails.up', field: 'regressionChannel' });
  t('fixture 来源（已登记）通过', r3.ok, r3.ok ? '' : JSON.stringify(r3.violations));

  /* 非窗口型指标不强制 window */
  const r4 = prov.validate({ source: 'tencent', asOf: '2026-10-08 15:00',
    computedAt: NOW, formula: 'quote.price', inputs: ['qt.gtimg.cn'] },
    { path: 'quote.price', field: 'price' });
  t('非窗口型指标不要求 window', r4.ok, r4.ok ? '' : JSON.stringify(r4.violations));
}

/* ---------------- ③ 两阶段模式 ---------------- */
console.log('\n── ③ soft / hard 两阶段模式 ──');

{
  const bad = { source: 'unknown-src', asOf: NOW, computedAt: NOW, formula: 'x', inputs: ['a'] };

  prov.resetRegistry();
  prov.setMode('soft');
  const softOut = prov.guard(bad, { path: 'chart.boll', field: 'boll20' });
  t('soft 模式：放行（不破坏渲染）', softOut === bad);
  t('soft 模式：仍登记违规', prov.getRegistry().length === 1,
    '登记 ' + prov.getRegistry().length + ' 条');

  prov.resetRegistry();
  prov.setMode('hard');
  const hardOut = prov.guard(bad, { path: 'chart.boll', field: 'boll20' });
  t('hard 模式：拒绝渲染（返回 null）', hardOut === null);
  t('hard 模式：登记违规', prov.getRegistry().length === 1);

  prov.resetRegistry();
  const strictOut = prov.guardStrict(GOOD, { path: 'chart.ma5', field: 'ma5' });
  t('guardStrict：合规仍放行', strictOut === GOOD);

  prov.setMode('soft');
}

/* ---------------- ④ 违规登记与文案 ---------------- */
console.log('\n── ④ 拒绝时必须留痕且有可见文案 ──');

{
  prov.resetRegistry();
  prov.setMode('hard');
  prov.guard(null, { path: 'chart.rails.up', field: 'regressionChannel' });
  const reg = prov.getRegistry();
  t('拒绝后登记表非空', reg.length === 1);
  t('登记项含路径与违规码', reg[0].path === 'chart.rails.up' && !!reg[0].code);

  const sum = prov.registrySummary();
  t('登记表可按违规码聚合', sum.total === 1 && !!sum.byCode.NO_PROVENANCE);

  const text = prov.reasonText('NO_PROVENANCE');
  t('拒绝理由有人可读文案', typeof text === 'string' && text.length > 4 && text !== 'NO_PROVENANCE', text);

  prov.setMode('soft');
  prov.resetRegistry();
}

/* ---------------- ⑤ 构造器不产生漏字段 ---------------- */
console.log('\n── ⑤ wrap() 构造器保证不漏字段 ──');

{
  const env = prov.wrap(42.5, GOOD);
  const r = prov.validate(env, { path: 'chart.ma5', field: 'ma5' });
  t('wrap() 产出的信封直接合规', r.ok, r.ok ? '' : JSON.stringify(r.violations));
  t('wrap() 保留原值', env.value === 42.5);

  const bare = prov.wrap(1, {});
  t('wrap() 只给值不给溯源 → 不合规（不得误判为通过）',
    !prov.validate(bare, { path: 'x', field: 'ma5' }).ok);
}

console.log('\n' + '='.repeat(72));
console.log('  通过 ' + pass + '   失败 ' + fail);
console.log('='.repeat(72) + '\n');
process.exit(fail === 0 ? 0 : 1);
