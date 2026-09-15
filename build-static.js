'use strict';
/**
 * 静态版构建脚本：把 lib/ 下的 CommonJS 模块打包成浏览器可用的 docs/bundle.js，
 * 并同步前端资源到 docs/，供 GitHub Pages 等纯静态环境托管。
 *
 * 用法：node build-static.js
 */
const fs = require('fs');
const path = require('path');
const { scanPath } = require('./scripts/scan-secrets');

const ROOT = __dirname;
const PUB = path.join(ROOT, 'public');
const OUT = path.join(ROOT, 'docs');

/** 打包顺序即依赖顺序；config 必须最先（凭据入口） */
const MODULES = [
  ['config', 'lib/config.js'],
  ['source', 'lib/source.js'],
  ['tech', 'lib/tech.js'],
  ['rules', 'lib/rules.js'],
  ['report', 'lib/report.js'],
  ['engine', 'lib/engine.js']
];

/**
 * 剥离 `@node-only` 区块。
 * 这是防泄漏的第一道闸门：任何读取凭据、或仅在服务端成立的代码都包在这个标记里，
 * 打包成公开的浏览器产物时会被整段删除 —— 代码不存在，自然无从扒取。
 */
const NODE_ONLY_RE = /[ \t]*\/\* @node-only \*\/[\s\S]*?\/\* @end-node-only \*\/\r?\n?/g;

function stripNodeOnly(code, relFile) {
  const open = (code.match(/\/\* @node-only \*\//g) || []).length;
  const close = (code.match(/\/\* @end-node-only \*\//g) || []).length;
  if (open !== close) {
    throw new Error(`${relFile} 的 @node-only 标记不配对：开始 ${open} 个，结束 ${close} 个`);
  }
  return code.replace(NODE_ONLY_RE, '');
}

/** 包装一个 CommonJS 模块，并把相对 require 改写为模块名 */
function wrapModule(name, relFile) {
  const abs = path.join(ROOT, relFile);
  let code = stripNodeOnly(fs.readFileSync(abs, 'utf8'), relFile);

  code = code
    .replace(/require\((['"])\.\/([a-zA-Z0-9_-]+)\1\)/g, "require('$2')")
    .replace(/require\((['"])\.\.\/data\/profiles\.json\1\)/g, "require('profiles')");

  const leftovers = code.match(/require\((['"])\.{1,2}\//g);
  if (leftovers) throw new Error(`${relFile} 仍存在未处理的相对 require：${leftovers.join(', ')}`);

  return `/* ===== ${relFile} ===== */\n__define('${name}', function (module, exports, require) {\n${code}\n});`;
}

function build() {
  fs.mkdirSync(OUT, { recursive: true });

  const profiles = fs.readFileSync(path.join(ROOT, 'data', 'profiles.json'), 'utf8');
  JSON.parse(profiles); // 提前校验 JSON 合法性

  const bundle = `/*! StockSentry 静态运行时 —— 由 build-static.js 自动生成，请勿手工编辑。源码见 lib/ */
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

var PROFILES_DATA = ${profiles};

${MODULES.map(([n, f]) => wrapModule(n, f)).join('\n\n')}

window.SentryLib = {
  config: __require('config'),
  source: __require('source'),
  tech: __require('tech'),
  rules: __require('rules'),
  report: __require('report'),
  engine: __require('engine'),
  profiles: PROFILES_DATA,
  IS_NODE: false
};
})();
`;

  fs.writeFileSync(path.join(OUT, 'bundle.js'), bundle, 'utf8');

  // 同步前端资源
  fs.copyFileSync(path.join(PUB, 'style.css'), path.join(OUT, 'style.css'));
  fs.copyFileSync(path.join(PUB, 'app.js'), path.join(OUT, 'app.js'));
  fs.copyFileSync(path.join(ROOT, 'static-api.js'), path.join(OUT, 'static-api.js'));

  // 注入静态版脚本
  const html = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
  const marker = '<script src="app.js"></script>';
  if (!html.includes(marker)) throw new Error('public/index.html 中未找到 app.js 引入标记');
  const staticHtml = html.replace(marker, [
    '<script>window.__SENTRY_STATIC__ = true;</script>',
    '<script src="bundle.js"></script>',
    '<script src="static-api.js"></script>',
    '<script src="app.js"></script>'
  ].join('\n'));

  fs.writeFileSync(path.join(OUT, 'index.html'), staticHtml, 'utf8');
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '', 'utf8');

  /* ---------------------------------------------------------------- */
  /* 防泄漏闸门：产物是要公开发布的，必须逐字节扫描，命中即中止构建      */
  /* ---------------------------------------------------------------- */
  const findings = scanPath(OUT);
  const errors = findings.filter((f) => f.sev === 'error');
  const warns = findings.filter((f) => f.sev === 'warn');

  if (errors.length) {
    console.error('\n❌ 构建中止：产物中发现疑似凭据');
    for (const f of errors) console.error(`   [${f.rule}] ${f.file}:${f.line} → ${f.preview}`);
    console.error('   处理方式：把相关代码移入 /* @node-only */ … /* @end-node-only */ 区块，');
    console.error('   或改从 lib/config.js 的 secret() 读取，绝不要在源码里写字面量。');
    process.exit(1);
  }
  if (warns.length) {
    console.warn('\n⚠️  以下内容请人工确认不是密钥：');
    for (const f of warns) console.warn(`   [${f.rule}] ${f.file}:${f.line} → ${f.preview}`);
  }

  const bundleSrc = fs.readFileSync(path.join(OUT, 'bundle.js'), 'utf8');
  if (/process\.env/.test(bundleSrc)) throw new Error('bundle.js 中仍存在 process.env，请检查 @node-only 标记');
  if (/require\((['"])\.{1,2}\//.test(bundleSrc)) throw new Error('bundle.js 中仍存在相对 require');

  const size = (f) => (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(1) + ' KB';
  console.log('\n静态版构建完成 → docs/');
  ['index.html', 'bundle.js', 'static-api.js', 'app.js', 'style.css'].forEach((f) =>
    console.log(`  ${f.padEnd(16)} ${size(f)}`));
  console.log(`  ${'密钥扫描'.padEnd(14)} ✅ 通过（0 处凭据）`);
}

build();
