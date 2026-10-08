'use strict';
/**
 * 溯源契约闸门
 * =============
 * 验证「任何指标计算模块，如果不输出溯源信息，不允许接入渲染管线」这条架构契约。
 *
 * 做法
 * ----
 * 不读文档、不查注释 —— 直接跑一遍真实分析，**遍历渲染管线实际消费的每一条数据路径**，
 * 逐条校验其是否携带溯源信封。这样得到的是事实，不是声明。
 *
 * 退出码
 * ------
 *   0 = 全部合规
 *   1 = 存在不合规（闸门未过）
 *   2 = 脚本自身异常
 *
 * 用法：
 *   node scripts/verify-provenance-contract.js
 *   node scripts/verify-provenance-contract.js --code 600519   # 换标的
 *   node scripts/verify-provenance-contract.js --json          # 只出 JSON
 */
const path = require('path');
const prov = require('../lib/provenance.js');
const engine = require('../lib/engine.js');

const argv = process.argv.slice(2);
const CODE = (() => {
  const i = argv.indexOf('--code');
  return i >= 0 ? argv[i + 1] : '600519';
})();
const JSON_ONLY = argv.includes('--json');

/**
 * 棘轮模式 —— 迁移期的正确闸门形态
 * ----------------------------------
 * 契约落地时合规率必然是 0%（尚无任何指标带溯源）。此时两种做法都是错的：
 *   · 直接硬失败 → 构建永远红，迁移期无法部署，人会习惯性绕过
 *   · 加 `|| true` → 闸门等于没有，永远到不了 24/24
 *
 * 棘轮的做法：**合规率只能升不能降**。
 *   · 低于已记录基线 → 失败（不许回退）
 *   · 等于基线       → 通过，但提示还差多少
 *   · 高于基线       → 通过，并自动更新基线（棘轮前进一格）
 * 这样迁移过程中每补一个模块就锁死一格，不可能边补边退。
 */
const RATCHET = argv.includes('--ratchet');
const BASELINE_PATH = path.join(__dirname, 'provenance-baseline.json');

function loadBaseline() {
  try { return JSON.parse(require('fs').readFileSync(BASELINE_PATH, 'utf8')); }
  catch { return null; }
}
function saveBaseline(compliant, total) {
  require('fs').writeFileSync(BASELINE_PATH,
    JSON.stringify({ compliant, total, updatedAt: new Date().toISOString() }, null, 2) + '\n', 'utf8');
}

/* ---------------------------------------------------------------------------
 * 渲染管线实际消费的数据路径
 * ---------------------------------------------------------------------------
 * 这份清单是契约的**适用范围**：只有列在这里的路径才受约束。
 * 新增图层时必须同步登记到这里，否则闸门覆盖不到它。
 * ------------------------------------------------------------------------- */

const PIPELINE = [
  // 主图
  { path: 'chart.kline',            module: 'kline',      kind: 'series', windowHint: null },
  { path: 'chart.boll.up',          module: 'boll',       kind: 'series', windowHint: 'boll20' },
  { path: 'chart.boll.mid',         module: 'boll',       kind: 'series', windowHint: 'boll20' },
  { path: 'chart.boll.dn',          module: 'boll',       kind: 'series', windowHint: 'boll20' },
  { path: 'chart.rails.up',         module: 'rails',      kind: 'series', windowHint: 'regressionChannel' },
  { path: 'chart.rails.mid',        module: 'rails',      kind: 'series', windowHint: 'regressionChannel' },
  { path: 'chart.rails.dn',         module: 'rails',      kind: 'series', windowHint: 'regressionChannel' },
  { path: 'ind.ma.ma5',             module: 'ma',         kind: 'scalar', windowHint: 'ma5' },
  { path: 'ind.ma.ma20',            module: 'ma',         kind: 'scalar', windowHint: 'ma20' },
  { path: 'ind.ma.ma60',            module: 'ma',         kind: 'scalar', windowHint: 'ma60' },
  // 副图
  { path: 'chart.macd.dif',         module: 'macd',       kind: 'series', windowHint: 'macd' },
  { path: 'chart.macd.dea',         module: 'macd',       kind: 'series', windowHint: 'macd' },
  { path: 'chart.macd.hist',        module: 'macd',       kind: 'series', windowHint: 'macd' },
  { path: 'ind.rsi',                module: 'rsi',        kind: 'scalar', windowHint: 'rsi14' },
  { path: 'ind.kdj.k',              module: 'kdj',        kind: 'scalar', windowHint: 'kdj9' },
  { path: 'ind.kdj.d',              module: 'kdj',        kind: 'scalar', windowHint: 'kdj9' },
  { path: 'ind.kdj.j',              module: 'kdj',        kind: 'scalar', windowHint: 'kdj9' },
  { path: 'ind.atr',                module: 'atr',        kind: 'scalar', windowHint: 'atr14' },
  // 轨道研判
  { path: 'ind.donchian.upper',     module: 'donchian',   kind: 'scalar', windowHint: 'donchian20' },
  { path: 'ind.donchian.lower',     module: 'donchian',   kind: 'scalar', windowHint: 'donchian20' },
  { path: 'ind.bollInfo',           module: 'bollState',  kind: 'object', windowHint: 'boll20' },
  { path: 'ind.channelVerdict',     module: 'channelVerdict', kind: 'object', windowHint: 'channel' },
  // 分时
  { path: 'chart.minutes',          module: 'minutes',    kind: 'series', windowHint: null },
  // 资金流
  { path: 'flow.today',             module: 'flow',       kind: 'object', windowHint: null },
];

function dig(obj, dotted) {
  return dotted.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/** 判断一条路径上的值是否"携带溯源信封"。
 *  信封形态：{ value, provenance:{...} } 或 { value, source, asOf, ... }（扁平形态亦接受）。 */
function extractEnvelope(node) {
  if (node == null || typeof node !== 'object') return null;
  if (node.provenance && typeof node.provenance === 'object') return node.provenance;
  /* 扁平形态：自身就带 source/asOf/formula 等字段 */
  if (node.source != null || node.formula != null) return node;
  return null;
}

(async () => {
  let analyzed;
  try {
    analyzed = await engine.analyze(CODE);
  } catch (e) {
    console.error('分析失败，无法执行契约闸门：' + e.message);
    process.exit(2);
  }

  prov.resetRegistry();

  const rows = PIPELINE.map((p) => {
    const node = dig(analyzed, p.path);
    const present = node !== undefined && node !== null;
    const env = extractEnvelope(node);
    const ctx = { path: p.path, field: p.windowHint || p.module, value: node };

    let ok = false;
    let codes = [];
    if (!present) {
      codes = ['PATH_ABSENT'];
    } else if (!env) {
      codes = ['NO_PROVENANCE'];
    } else {
      const r = prov.validate(env, ctx);
      ok = r.ok;
      codes = r.violations.map((v) => v.code);
    }

    return {
      module: p.module,
      path: p.path,
      kind: p.kind,
      present,
      hasEnvelope: !!env,
      ok,
      codes,
    };
  });

  /* ---------------- 按模块聚合 ---------------- */
  const byModule = {};
  rows.forEach((r) => {
    const m = byModule[r.module] || (byModule[r.module] = { module: r.module, total: 0, compliant: 0, absent: 0, paths: [] });
    m.total++;
    if (r.ok) m.compliant++;
    if (!r.present) m.absent++;
    m.paths.push(r);
  });
  const modules = Object.values(byModule).sort((a, b) => a.compliant / a.total - b.compliant / b.total);

  const total = rows.length;
  const compliant = rows.filter((r) => r.ok).length;
  const absent = rows.filter((r) => !r.present).length;
  const rate = total ? (compliant / total * 100) : 0;

  const report = {
    contract: '任何指标计算模块，如果不输出溯源信息，不允许接入渲染管线',
    code: CODE,
    checkedAt: new Date().toISOString(),
    pipelinePaths: total,
    compliant,
    nonCompliant: total - compliant,
    absent,
    complianceRate: +rate.toFixed(1),
    byModule: modules.map((m) => ({
      module: m.module,
      paths: m.total,
      compliant: m.compliant,
      absent: m.absent,
      rate: +(m.compliant / m.total * 100).toFixed(1),
    })),
    details: rows,
  };

  if (JSON_ONLY) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(compliant === total ? 0 : 1);
  }

  /* ---------------- 输出 ---------------- */
  console.log('\n' + '='.repeat(76));
  console.log('  溯源契约闸门');
  console.log('  契约：任何指标计算模块，如果不输出溯源信息，不允许接入渲染管线');
  console.log('='.repeat(76));
  console.log('  标的 ' + CODE + '   受约束路径 ' + total + ' 条\n');

  console.log('  ' + '模块'.padEnd(18) + '路径'.padStart(6) + '合规'.padStart(8)
    + '缺失'.padStart(8) + '合规率'.padStart(10));
  console.log('  ' + '-'.repeat(72));
  modules.forEach((m) => {
    const r = (m.compliant / m.total * 100).toFixed(0) + '%';
    const flag = m.compliant === m.total ? '  ✅' : (m.compliant === 0 ? '  ❌' : '  ⚠️');
    console.log('  ' + m.module.padEnd(18) + String(m.total).padStart(6)
      + String(m.compliant).padStart(8) + String(m.absent).padStart(8)
      + r.padStart(10) + flag);
  });

  console.log('\n  ' + '-'.repeat(72));
  console.log('  合计：' + compliant + '/' + total + ' 条合规（' + report.complianceRate + '%）'
    + '，其中 ' + absent + ' 条路径本身不存在');

  /* 不合规明细（按模块归并，避免刷屏） */
  const bad = modules.filter((m) => m.compliant < m.total);
  if (bad.length) {
    console.log('\n  ── 不合规明细 ──');
    bad.forEach((m) => {
      const codes = {};
      m.paths.filter((p) => !p.ok).forEach((p) => {
        p.codes.forEach((c) => { codes[c] = (codes[c] || 0) + 1; });
      });
      console.log('    ' + m.module + '：' + Object.entries(codes)
        .map(([c, n]) => c + '×' + n).join('  '));
    });
  }

  console.log('\n' + '='.repeat(76));

  /* ---------------- 棘轮判定 ---------------- */
  let exitCode;
  if (compliant === total) {
    console.log('  ✅ 闸门通过：全部渲染管线路径均携带溯源信息');
    console.log('     → 可以执行阶段切换：prov.setMode("hard")，让契约从"记录"转为"硬拒绝"');
    if (RATCHET) { saveBaseline(compliant, total); console.log('     → 基线已更新为 ' + compliant + '/' + total); }
    exitCode = 0;
  } else if (RATCHET) {
    const base = loadBaseline();
    const floor = base ? base.compliant : 0;
    if (compliant < floor) {
      console.log('  ❌ 棘轮回退：合规率 ' + compliant + '/' + total
        + ' 低于已记录基线 ' + floor + '/' + (base ? base.total : total));
      console.log('     → 有图层在补溯源的过程中退回了未合规状态');
      exitCode = 1;
    } else if (compliant > floor) {
      saveBaseline(compliant, total);
      console.log('  ✅ 棘轮前进：' + floor + ' → ' + compliant + ' / ' + total
        + '（基线已更新，回退将被拦截）');
      console.log('     还差 ' + (total - compliant) + ' 条达到 100%');
      exitCode = 0;
    } else {
      console.log('  ✅ 棘轮保持：' + compliant + '/' + total
        + '（未回退，但本次也无进展）');
      console.log('     还差 ' + (total - compliant) + ' 条达到 100%');
      /* 首次运行（尚无基线文件）时落盘，否则棘轮没有起点，拦不住后续回退 */
      if (!base) { saveBaseline(compliant, total); console.log('     → 已建立棘轮起点基线'); }
      exitCode = 0;
    }
  } else {
    console.log('  ❌ 闸门未过：' + (total - compliant) + ' 条路径缺少溯源信息');
    console.log('     → 这些图层在契约下**不允许进入渲染管线**');
    console.log('     → 改造顺序：先给 lib/tech.js 的 computeIndicators 及各指标函数补溯源，');
    console.log('       再在 public/app.js 的绘图入口接 prov.guard()');
    exitCode = 1;
  }
  console.log('='.repeat(76) + '\n');

  process.exit(exitCode);
})().catch((e) => { console.error('异常: ' + e.stack); process.exit(2); });
