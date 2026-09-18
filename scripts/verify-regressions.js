'use strict';
/**
 * 逻辑回归测试 —— 信号档位与价位推导
 * ================================================================
 * 为什么需要这个文件：
 *   `build-static.js` 只验证构建与模块引用，`verify-ui-dom.js` 只验证 DOM 渲染，
 *   `verify-browser-path.js` 只验证数据传输链路。三者都不会触及"某个 RSI 取值
 *   有没有产出信号""两个目标位挨得够不够远"这类**逻辑完备性**问题 ——
 *   而这正是静默缺陷的高发区：不报错、不留痕、只在特定取值下丢结果。
 *
 * 纯 Node、零依赖（与项目其余脚本一致），直接 require lib/ 下的模块。
 * 用法：node scripts/verify-regressions.js        （退出码 0=全通过）
 */
const rules = require('../lib/rules');
const portrait = require('../lib/portrait');

let pass = 0;
let fail = 0;
function check(name, cond, detail) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/* ------------------------------------------------------------------ */
/* 工具：构造最小可用 ind                                              */
/* ------------------------------------------------------------------ */
/**
 * technicalRules 会读取 ind 的十余个字段。用 Proxy 兜底返回 null，
 * 使不关心的分支自然短路（`ind.ma.ma20 != null` → false），
 * 从而把测试聚焦在 RSI 段，而不必手写一份完整指标对象。
 */
function fakeInd(rsi) {
  const base = { rsi, price: 30, ma: {}, macd: {}, kdj: {}, returns: {} };
  return new Proxy(base, { get: (t, k) => (k in t ? t[k] : null) });
}
function rsiSignals(rsi) {
  return rules.technicalRules({ ind: fakeInd(rsi), quote: {}, flow: null })
    .filter((s) => String(s.id).indexOf('rsi') === 0);
}

/* ================================================================== */
console.log('===== 回归测试 · RSI 档位完备性 =====');
/* ================================================================== */

/* 1. 原缺陷本体：(45, 55) 区间必须产出信号 */
[46, 48, 50, 53.9].forEach((v) => {
  const s = rsiSignals(v);
  check(`RSI=${v} 落在中性区间应产出信号`,
    s.length === 1 && s[0].id === 'rsi-mid',
    `实得 ${s.length} 条 ${s.map((x) => x.id).join(',') || '（无信号）'}`);
});

/* 2. 边界等价性：前四档必须与原 if/else if 链逐字一致（含边界值） */
const BOUNDARY = [
  [90, 'rsi-ob'], [75, 'rsi-ob'],
  [74.9, 'rsi-strong'], [55, 'rsi-strong'],
  [54.9, 'rsi-mid'], [45.1, 'rsi-mid'],
  [45, 'rsi-weak'], [28.1, 'rsi-weak'],
  [28, 'rsi-os'], [10, 'rsi-os']
];
BOUNDARY.forEach(([v, want]) => {
  const s = rsiSignals(v);
  check(`RSI=${v} → ${want}`,
    s.length === 1 && s[0].id === want,
    `实得 ${s.map((x) => x.id).join(',') || '（无信号）'}`);
});

/* 3. 完备性扫描：全域每一步都必须恰好一条，杜绝任何新增空隙 */
let gaps = [];
for (let v = 0; v <= 100; v += 0.5) {
  const x = Math.round(v * 10) / 10;
  if (rsiSignals(x).length !== 1) gaps.push(x);
}
check('RSI 在 [0, 100] 全域扫描（步长 0.5，共 201 点）每点恰好 1 条信号',
  gaps.length === 0,
  gaps.length ? `存在 ${gaps.length} 处空隙：${gaps.slice(0, 5).join(', ')}…` : '无空隙');

/* ================================================================== */
console.log('\n===== 回归测试 · 第二目标位最小间距 =====');
/* ================================================================== */

function indOf(keyLevels, price, atr) {
  const m = { ma5: price, ma10: price, ma20: price, ma30: price, ma60: price, ma120: price };
  return { price, atr, keyLevels, ma: m };
}
const SUPPORTS = [{ price: 38, side: 'support' }, { price: 37, side: 'support' }];

/* 4. 原缺陷本体：阻力位序列在 target1 上方几乎重合 */
const dense = SUPPORTS.concat([
  { price: 41.2, side: 'resistance' },
  { price: 41.25, side: 'resistance' },   // 仅比 41.2 高 0.05 —— 修复前会被选为 target2
  { price: 45.0, side: 'resistance' }
]);
const dLv = portrait.deriveLevels(indOf(dense, 40, 1));
const gap = dLv.target2 - dLv.target1;
check('阻力位密集时，两档目标位间距 ≥ 1.2×ATR',
  gap >= 1.2 - 1e-9,
  `target1=${dLv.target1} target2=${dLv.target2} 间距=${gap.toFixed(2)}（阈值 1.2）`);

/* 5. 不过度修正：间距本就充足时，必须沿用真实阻力位 */
const normal = SUPPORTS.concat([
  { price: 41.2, side: 'resistance' },
  { price: 45.0, side: 'resistance' }
]);
const nLv = portrait.deriveLevels(indOf(normal, 40, 1));
check('间距充足时沿用真实阻力位（不被过度修正）',
  nLv.target2 === 45,
  `target1=${nLv.target1} target2=${nLv.target2}（期望 45）`);

/* 6. 目标位不低于现价 1.2×ATR（既有防护，守卫不回归） */
check('第一目标位与现价保持 ≥ 1.2×ATR 距离',
  dLv.target1 - 40 >= 1.2 - 1e-9,
  `target1=${dLv.target1}，现价 40，ATR 1`);

/* ================================================================== */
console.log('\n===== 回归测试 · 坏数据不得产生倒挂价位 =====');
/* ================================================================== */

[-1, 0, null, NaN, undefined].forEach((bad) => {
  const lv = portrait.deriveLevels({ price: 40, atr: bad, keyLevels: SUPPORTS, ma: {} });
  const ordered = lv.hardStop < lv.stopLoss && lv.stopLoss < lv.entry[0]
    && lv.entry[0] < lv.entry[1] && lv.entry[1] < 40;
  check(`atr=${String(bad)} 时价位序列不倒挂`,
    ordered,
    `entry=[${lv.entry}] stop=${lv.stopLoss} hard=${lv.hardStop}`);
});

/* ================================================================== */
console.log(`\n通过 ${pass} 项，失败 ${fail} 项`);
console.log(fail ? '存在失败项' : '全部通过');
process.exit(fail ? 1 : 0);
