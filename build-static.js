'use strict';
/**
 * 静态版构建脚本：把 lib/ 下的 CommonJS 模块打包成浏览器可用的 docs/bundle.js，
 * 并同步前端资源到 docs/，供 GitHub Pages 等纯静态环境托管。
 *
 * 用法：node build-static.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PUB = path.join(ROOT, 'public');
const OUT = path.join(ROOT, 'docs');

const MODULES = [
  ['source', 'lib/source.js'],
  ['tech', 'lib/tech.js'],
  ['rules', 'lib/rules.js'],
  ['report', 'lib/report.js'],
  ['engine', 'lib/engine.js']
];

/** 包装一个 CommonJS 模块，并把相对 require 改写为模块名 */
function wrapModule(name, relFile) {
  const abs = path.join(ROOT, relFile);
  let code = fs.readFileSync(abs, 'utf8');

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

  const bundle = `/*! StockSentry 静态运行时 —— 由 build-static.js 于 ${new Date().toISOString()} 自动生成，请勿手工编辑 */
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

  const size = (f) => (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(1) + ' KB';
  console.log('静态版构建完成 → docs/');
  ['index.html', 'bundle.js', 'static-api.js', 'app.js', 'style.css'].forEach((f) =>
    console.log(`  ${f.padEnd(16)} ${size(f)}`));
}

build();
