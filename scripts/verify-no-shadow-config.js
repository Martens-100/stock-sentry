'use strict';
/**
 * 无影子配置闸门
 * ==============
 *
 * 背景
 * ----
 * "同一个事实有两个声明处"是本项目已经踩过并造成实际损害的一类缺陷：
 * 部署脚本把忽略规则硬编码在代码里，而不是读 .gitignore，结果换了根目录后
 * 规则静默失效，把 11 个构建产物推上了远程仓库。
 *
 * 这类缺陷的危险之处在于失效方向是**静默地多做一件事** —— 不报错、不告警，
 * 只是系统的边界被悄悄改变了。
 *
 * 本闸门的做法
 * ------------
 * 不搞全局 AST 禁令（那会连配置声明处一起禁掉，无法实现），
 * 也不做 config_hash（静态产物里配置被内联，运行时与构建时必然相等，检查是同义反复）。
 * 只做**一致性断言**：每个"应当唯一"的事实，断言它的声明处与消费处彼此吻合。
 * 成本极低，且漂移一旦发生立刻变红。
 *
 * 覆盖的四类
 * ----------
 *   A 重复字面量  —— 网络超时
 *   B 派生值      —— 像素闸门的测试视口必须由 CSS 断点推导
 *   C 约定        —— 指标预热：只填 null，绝不 slice（切片会破坏 X 轴对齐）
 *   D 单一声明    —— 构建产物目录
 *
 * 退出码：0 = 全部一致；1 = 检出影子配置
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => { try { return fs.readFileSync(path.join(ROOT, p), 'utf8'); } catch { return ''; } };

/**
 * 去掉注释后再扫描。
 *
 * 必须这么做的原因（本闸门开发时连踩三次的坑）：
 * 源码注释里经常要写"不要用 pkg.browser"、"不得读取 process.env"这类**警示**，
 * 而扫描器如果连注释一起匹配，就会把"警告不要做某事"当成"正在做某事" ——
 * 于是越认真地写警示，越容易被自己写的闸门判失败。
 *
 * 这不是措辞问题，是扫描粒度问题：一致性断言应当针对**代码**，不是散文。
 * 因此这里先剥掉块注释与行注释再匹配。
 * 行注释的 `//` 只在行首或空白之后才算，避免误伤 URL 里的 https://。
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/[^\n]*/g, '$1');
}
const readCode = (p) => stripComments(read(p));

let pass = 0;
const fails = [];

function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fails.push(name); console.log('  ❌ ' + name + (detail ? '\n       → ' + detail : '')); }
}

console.log('\n' + '='.repeat(74));
console.log('  无影子配置闸门');
console.log('  断言：每个「应当唯一」的事实，其声明处与消费处必须吻合');
console.log('='.repeat(74));

/* ────────────────────────────────────────────────────────────────
 * A. 网络超时 —— 重复字面量
 * ──────────────────────────────────────────────────────────────*/
console.log('\n── A. 网络超时（重复字面量） ──');
{
  const NP = require('../lib/net-params.js');
  const src = readCode('lib/source.js');

  ok('net-params.js 声明了 API_TIMEOUT_MS 等常量',
    Number.isFinite(NP.API_TIMEOUT_MS) && Number.isFinite(NP.FAST_TIMEOUT_MS),
    '当前值 ' + JSON.stringify(NP));

  const bare = src.match(/(?:timeout\s*[:=]\s*)\d{3,}/g) || [];
  ok('source.js 中不再出现裸超时字面量', bare.length === 0,
    '发现 ' + bare.length + ' 处：' + bare.slice(0, 5).join(', '));

  ok('source.js 确实引用了 net-params', /require\(['"]\.\/net-params['"]\)/.test(src));

  /* 同构硬约束：一旦引入 Node 专有 API 或读环境变量，浏览器产物会崩 */
  const npSrc = readCode('lib/net-params.js');
  ok('net-params.js 不含任何 require（必须双端同构）', !/require\s*\(/.test(npSrc));
  ok('net-params.js 不读取环境变量（浏览器侧没有这一层）',
    !/process\s*\.\s*env/.test(npSrc) && !/process\s*\[/.test(npSrc));
}

/* ────────────────────────────────────────────────────────────────
 * B. 测试视口 —— 派生值必须从 CSS 断点推导
 * ──────────────────────────────────────────────────────────────*/
console.log('\n── B. 像素闸门视口（派生值） ──');
{
  const vSrc = readCode('scripts/verify-v1-v7.js');
  const { viewportsFor } = require('./lib/breakpoints.js');
  const list = viewportsFor(path.join(ROOT, 'public/style.css'));

  ok('verify-v1-v7.js 不再写死视口宽度',
    !/viewport:\s*\{\s*width:\s*\d+/.test(vSrc));

  ok('verify-v1-v7.js 从 breakpoints 模块取视口',
    /require\(['"]\.\/lib\/breakpoints['"]\)/.test(vSrc));

  ok('从 style.css 解析出的视口矩阵非空且覆盖多个分支', list.length >= 6,
    '实际 ' + list.length + ' 个');

  /* 关键：此前从未被测的平板区间必须进入矩阵 */
  const tablet = list.filter((v) => v.width >= 620 && v.width <= 1200);
  ok('矩阵覆盖 620–1200 平板区间（此前完全漏测的分支）', tablet.length > 0,
    '当前矩阵宽度：' + list.map((v) => v.width).join(', '));
}

/* ────────────────────────────────────────────────────────────────
 * C. 指标预热 —— 只填 null，绝不 slice
 * ──────────────────────────────────────────────────────────────*/
console.log('\n── C. 指标预热（约定） ──');
{
  const tech = require('../lib/tech.js');
  const N = 60;
  const closes = Array.from({ length: N }, (_, i) => 100 + Math.sin(i / 3) * 5 + i * 0.1);
  const highs = closes.map((c) => c + 1.2);
  const lows = closes.map((c) => c - 1.1);

  ok('tech.js 导出 WARMUP_FIRST_INDEX 作为唯一约定声明处',
    tech.WARMUP_FIRST_INDEX && typeof tech.WARMUP_FIRST_INDEX.atr === 'function');

  const m = tech.macd(closes);
  const a = tech.atr(highs, lows, closes, 14);
  const e = tech.ema(closes, 20);

  /* 长度不变是 X 轴对齐的基石：任何 slice 都会让指标线与日期轴错位 */
  ok('atr 输出长度 == 输入长度（未被 slice）', a.length === N, a.length + ' ≠ ' + N);
  ok('ema 输出长度 == 输入长度（未被 slice）', e.length === N, e.length + ' ≠ ' + N);
  ok('macd 三条线长度均 == 输入长度（旧 .filter 会压成 35）',
    m.dif.length === N && m.dea.length === N && m.hist.length === N,
    m.dif.length + '/' + m.dea.length + '/' + m.hist.length);

  /* 首个有效下标必须等于声明值 */
  const first = (arr) => arr.findIndex((x) => x != null);
  const W = tech.WARMUP_FIRST_INDEX;
  ok('atr.14 首个有效下标 == 声明值 ' + W.atr({ n: 14 }),
    first(a) === W.atr({ n: 14 }), '实际 ' + first(a));
  ok('macd.dif 首个有效下标 == 声明值 ' + W.macdDif({ slow: 26 }),
    first(m.dif) === W.macdDif({ slow: 26 }), '实际 ' + first(m.dif));
}

/* ────────────────────────────────────────────────────────────────
 * D. 构建产物目录 —— 单一声明
 * ──────────────────────────────────────────────────────────────*/
console.log('\n── D. 构建产物目录（单一声明） ──');
{
  const pkg = JSON.parse(read('package.json'));
  const bs = readCode('build-static.js');

  const declared = pkg.sentryConfig && pkg.sentryConfig.staticOutDir;
  ok('package.json 声明 sentryConfig.staticOutDir', !!declared, '当前值 ' + declared);

  ok('build-static.js 从 package.json 读取输出目录，而非写死路径',
    /sentryConfig/.test(bs) && !/path\.join\(ROOT,\s*['"]docs['"]\)/.test(bs));

  /* 不得挪用 npm 标准字段 —— 它们有各自语义，误用会静默回落 */
  ok('未误用 pkg.browser / pkg.directories',
    !/pkg\.browser/.test(bs) && !/pkg\.directories/.test(bs));

  if (declared) {
    ok('声明的目录真实存在（产物已构建）',
      fs.existsSync(path.join(ROOT, declared, 'bundle.js')),
      '未找到 ' + declared + '/bundle.js');
  }
}

console.log('\n' + '='.repeat(74));
if (fails.length === 0) {
  console.log('  ✅ 闸门通过：' + pass + ' 项一致性断言全部成立，未检出影子配置');
} else {
  console.log('  ❌ 检出 ' + fails.length + ' 处影子配置：');
  fails.forEach((f) => console.log('     · ' + f));
}
console.log('='.repeat(74) + '\n');

process.exit(fails.length ? 1 : 0);
