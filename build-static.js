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

/**
 * 打包清单（顺序仅影响末尾 window.SentryLib 的求值顺序，模块本身是惰性 __define）。
 *
 * 注意这里**没有** lib/config.js：它是凭据入口，只有 Node 侧（server.js）需要。
 * 浏览器侧对它的唯一引用在 lib/source.js 的 @node-only 区块里（读 EASTMONEY_TOKEN），
 * 打包时会被整段剥离，因此公开产物里不存在任何读凭据的代码。
 * 一旦有浏览器侧代码 require('config')，构建期的「模块引用闸门」会直接报错。
 */
const MODULES = [
  ['source', 'lib/source.js'],
  ['tech', 'lib/tech.js'],
  ['monitors', 'lib/monitors.js'],
  ['portrait', 'lib/portrait.js'],
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

  // 同时覆盖模板字符串写法 require(`./x`)（反引号），否则会漏进浏览器产物
  const leftovers = code.match(/require\(\s*['"\`](\.{1,2}\/)/g);
  if (leftovers) throw new Error(`${relFile} 仍存在未处理的相对 require：${leftovers.join(', ')}`);

  return `/* ===== ${relFile} ===== */\n__define('${name}', function (module, exports, require) {\n${code}\n});`;
}

function build() {
  fs.mkdirSync(OUT, { recursive: true });

  const profilesObj = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'profiles.json'), 'utf8'));
  /**
   * 不能把 JSON 原文直接嵌进 <script>：只要画像数据里出现 `</script>`，
   * 浏览器就会提前闭合脚本标签，整段 bundle 被截断（注入面）。
   * 统一重新序列化并把 "<" 转义为 \u003c —— 在 JS/JSON 字符串里完全等价，
   * 但源码里再也不会出现字面量 `<`。
   */
  const profiles = JSON.stringify(profilesObj).replace(/</g, '\\u003c');

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
`;

  fs.writeFileSync(path.join(OUT, 'bundle.js'), bundle, 'utf8');

  // 同步前端资源
  fs.copyFileSync(path.join(PUB, 'style.css'), path.join(OUT, 'style.css'));
  fs.copyFileSync(path.join(PUB, 'app.js'), path.join(OUT, 'app.js'));
  fs.copyFileSync(path.join(ROOT, 'static-api.js'), path.join(OUT, 'static-api.js'));

  // 注入静态版脚本。标记必须「有且只有一个」：静默 replace 首个匹配太脆弱 ——
  // 一旦 HTML 里出现第二个 app.js 引用，就会漏掉一个没被包进静态运行时的脚本。
  const html = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
  const marker = '<script src="app.js"></script>';
  const markerCount = html.split(marker).length - 1;
  if (markerCount !== 1) {
    throw new Error(`public/index.html 中 app.js 引入标记应恰好 1 处，实际 ${markerCount} 处`);
  }
  const staticHtml = html.replace(marker, [
    '<script>window.__SENTRY_STATIC__ = true;</script>',
    '<script src="bundle.js"></script>',
    '<script src="static-api.js"></script>',
    '<script src="app.js"></script>'
  ].join('\n'));
  // 载入顺序是硬约束：bundle.js 提供 window.SentryLib，static-api.js 依赖它注册
  // window.SentryStatic，app.js 再通过 SentryStatic 取数。顺序错了会静默退化。
  const oBundle = staticHtml.indexOf('src="bundle.js"');
  const oApi = staticHtml.indexOf('src="static-api.js"');
  const oApp = staticHtml.indexOf('src="app.js"');
  if (!(oBundle >= 0 && oBundle < oApi && oApi < oApp)) {
    throw new Error('docs/index.html 脚本顺序错误，应为 bundle.js → static-api.js → app.js');
  }

  fs.writeFileSync(path.join(OUT, '.nojekyll'), '', 'utf8');

  /* ---------------------------------------------------------------- */
  /* 资源指纹：给 script/link 的 URL 带上内容哈希                        */
  /* ---------------------------------------------------------------- */
  /**
   * 为什么必须做：线上没有 Cache-Control 头，浏览器按启发式规则缓存，
   * 于是「页面更新了但用户一直跑旧脚本」成为最难排查的故障 —— 用户看到的
   * 是早已修好的 bug，开发者却在正确的代码里找问题。
   * 哈希取内容，所以内容一变 URL 就变，浏览器必然重新下载；
   * 内容不变则哈希不变，缓存依然有效（也不会破坏构建可复现性）。
   */
  const hashOf = (f) => require('crypto').createHash('sha256')
    .update(fs.readFileSync(path.join(OUT, f))).digest('hex').slice(0, 8);
  const fingerprints = {};
  for (const f of ['bundle.js', 'static-api.js', 'app.js', 'style.css']) fingerprints[f] = hashOf(f);

  let versionedHtml = staticHtml.replace(
    /(src|href)="(bundle|static-api|app)\.js"/g,
    (m, attr, base) => `${attr}="${base}.js?v=${fingerprints[base + '.js']}"`
  );
  versionedHtml = versionedHtml.replace(/href="style\.css"/, `href="style.css?v=${fingerprints['style.css']}"`);
  fs.writeFileSync(path.join(OUT, 'index.html'), versionedHtml, 'utf8');

  // 指纹必须真的落到页面上，否则这套机制形同虚设
  for (const [f, h] of Object.entries(fingerprints)) {
    if (!versionedHtml.includes(`${f}?v=${h}`)) {
      throw new Error(`docs/index.html 未引用 ${f} 的内容指纹，资源版本化失效`);
    }
  }

  /* ---------------------------------------------------------------- */
  /* 单文件版：把 CSS / bundle / static-api / app 全部内联进一个 HTML     */
  /* ---------------------------------------------------------------- */
  /**
   * 为什么还要这个：多文件部署在「网络对静态资源不稳」的环境里会碎掉 ——
   * 典型就是国内访问 GitHub Pages，HTML 能出来但 155KB 的 bundle.js 超时，
   * 结果 window.SentryLib 为空、整页报"分析失败"。资源越多，越容易被逐个打断。
   *
   * 单文件只有 1 次请求，没有资源依赖、没有缓存版本错配，还能直接当附件发给别人
   * （微信 / AirDrop / 邮件）。用 file:// 打开时 fetch 会被浏览器禁止，
   * 但 lib/source.js 的 JSONP 兜底走 <script> 标签，不受该限制 —— 正好互补。
   */
  const inline = (code) => code.replace(/<\/script/gi, '<\\/script');   // 防止提前闭合脚本标签

  /**
   * 内联必须用「函数式替换」，绝不能用模板字符串当替换值。
   *
   * 踩过的坑：String.prototype.replace 会在**替换串**里解释 `$$`→`$`、`$&`、`$'`、
   * `` $` ``、`$1` 等特殊序列。源码里 `const $$ = (s) => Array.from(...)` 被当成替换值
   * 内联后塌缩成 `const $ = ...`，与上一行 `const $` 重复声明 → 整页 SyntaxError →
   * 白屏「分析失败」。这类 bug 静默、且只在单文件版出现，用 replacer 函数即根除。
   */
  const raw = (f) => fs.readFileSync(path.join(OUT, f), 'utf8');
  const assets = [
    // [待替换的位置, 原始内容, 内联进页面的文本]
    ['style.css', /<link[^>]*style\.css[^>]*>/, raw('style.css'), (c) => `<style>\n${c}\n</style>`],
    ['bundle.js', /<script src="bundle\.js[^"]*"><\/script>/, raw('bundle.js'), (c) => `<script>\n${inline(c)}\n</script>`],
    ['static-api.js', /<script src="static-api\.js[^"]*"><\/script>/, raw('static-api.js'), (c) => `<script>\n${inline(c)}\n</script>`],
    ['app.js', /<script src="app\.js[^"]*"><\/script>/, raw('app.js'), (c) => `<script>\n${inline(c)}\n</script>`]
  ];

  let standalone = versionedHtml;
  for (const [name, re, from] of assets) {
    if (!re.test(standalone)) throw new Error(`单文件内联失败：HTML 中找不到 ${name} 的引用位置`);
    standalone = standalone.replace(re, () => assets.find((a) => a[0] === name)[3](from));
  }

  /**
   * 内联保真闸门：逐字节确认每个源文件的内联结果确实出现在产物里。
   * 只要再有 `$` 特殊序列被吞、或 `</script` 转义漏做，这里立刻构建失败，
   * 而不是等到用户手机上白屏才发现。
   */
  for (const [name, , from, render] of assets) {
    if (!standalone.includes(render(from))) {
      throw new Error(`单文件内联内容与 docs/${name} 不一致（疑似 $ 特殊序列被吞或转义异常），构建中止`);
    }
  }

  for (const token of ['src="bundle.js', 'src="static-api.js', 'src="app.js', 'href="style.css']) {
    if (standalone.includes(token)) throw new Error(`单文件版仍存在外部引用：${token}`);
  }
  const standalonePath = path.join(ROOT, 'out', 'stock-sentry-standalone.html');
  fs.mkdirSync(path.dirname(standalonePath), { recursive: true });
  fs.writeFileSync(standalonePath, standalone, 'utf8');
  // 单文件同样是公开产物，必须过同一套凭据闸门（只扫这一个文件，避免误伤 out/ 里的历史文件）
  const saFindings = scanPath(standalonePath).filter((f) => f.sev === 'error');
  if (saFindings.length) {
    console.error('❌ 单文件版中发现疑似凭据：', saFindings.map((f) => `${f.line} → ${f.preview}`).join(', '));
    process.exit(1);
  }

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
  // 同时覆盖 process['env'] / process["env"] 这类括号访问写法，否则会漏过闸门
  if (/process\s*\.\s*env\b|process\s*\[\s*['"]\s*env\s*['"]\s*\]/.test(bundleSrc))
    throw new Error('bundle.js 中仍存在 process.env（含 process[\'env\'] 变体），请检查 @node-only 标记');
  if (/require\(\s*['"\`](\.{1,2}\/)/.test(bundleSrc)) throw new Error('bundle.js 中仍存在相对 require（含模板字符串写法）');

  /* ---------------------------------------------------------------- */
  /* 模块引用闸门：__require 找不到名字只会在浏览器里抛「模块未找到」，   */
  /* 那是运行期才暴露。改名/删模块后忘记同步时最容易踩，这里提前拦下。   */
  /* ---------------------------------------------------------------- */
  const known = new Set(MODULES.map(([n]) => n));
  known.add('profiles');                       // 由 profiles.json 直接注入的特殊模块
  const missing = new Set();
  const refRe = /(?:__)?require\(\s*['"]([^'"]+)['"]\s*\)/g;
  let rm;
  while ((rm = refRe.exec(bundleSrc))) {
    if (!known.has(rm[1])) missing.add(rm[1]);
  }
  if (missing.size) {
    throw new Error(`bundle.js 引用了未打包的模块：${[...missing].join(', ')}（请同步 build-static.js 的 MODULES）`);
  }

  /* 产物完整性：写出去的每个文件都必须存在且非空 */
  const ARTIFACTS = ['index.html', 'bundle.js', 'static-api.js', 'app.js', 'style.css'];
  for (const f of ARTIFACTS) {
    const abs = path.join(OUT, f);
    if (!fs.existsSync(abs) || fs.statSync(abs).size === 0) {
      throw new Error(`产物缺失或为空：docs/${f}`);
    }
  }

  const size = (f) => (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(1) + ' KB';
  console.log('\n静态版构建完成 → docs/');
  ARTIFACTS.forEach((f) => console.log(`  ${f.padEnd(16)} ${size(f)}`));
  console.log(`  ${'单文件版'.padEnd(14)} ${(fs.statSync(standalonePath).size / 1024).toFixed(1)} KB  → out/stock-sentry-standalone.html`);
  console.log(`  ${'模块引用'.padEnd(14)} ✅ 通过（${MODULES.length} 个模块，无悬空引用）`);
  console.log(`  ${'密钥扫描'.padEnd(14)} ✅ 通过（0 处凭据）`);
}

build();
