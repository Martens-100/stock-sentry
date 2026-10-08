'use strict';
/**
 * lib/provenance.js — 溯源契约
 * ==============================
 *
 * 架构契约
 * --------
 * **任何指标计算模块，如果不输出溯源信息，不允许接入渲染管线。**
 *
 * 为什么必须写死，而不是靠自觉
 * ----------------------------
 * 指标算错的后果是**不对称**的：
 *
 *   数值错了 → 图会明显不对。线跑到画布外、值域塌缩成一条、
 *             控制台抛 NaN —— 视觉与日志都能发现。
 *
 *   口径错了 → 图**看起来完全正常**，但含义全错。
 *             它不抛错、不告警、值域也正常，只是那条线代表的
 *             不是你以为的东西。**只能靠溯源信息暴露。**
 *
 * 典型例子：周线模式下沿用日线 MA5 的参数。图上是一条形态正常的均线，
 * 但它代表"最近 5 周"还是"最近 5 天"？没有溯源信息时，图上没有任何线索。
 * 这类缺陷正是本项目反复踩过的"沉默的错"。
 *
 * 契约的执行方式
 * --------------
 * 不靠文档约束，靠**准入守卫**：
 *   1. 渲染管线每个图层入口调用 guard() —— 不合格直接拒绝渲染
 *   2. 拒绝时写入违规登记表，界面给出**可见的拒绝理由**（不是静默跳过）
 *   3. 构建期脚本 scripts/verify-provenance-contract.js 扫描全量输出并出清单
 *
 * 与项目既有防御规范的关系
 * ------------------------
 * 既有代码在"图是空的"上做得很到位（空要有空的理由）。
 * 本契约解决的是它的对偶问题：**"图不是空的，但画错了"**。
 */

/* ---------------------------------------------------------------------------
 * 契约字段
 * ------------------------------------------------------------------------- */

/** 必填字段。缺任意一项即拒绝进入渲染管线。 */
const REQUIRED_FIELDS = ['source', 'asOf', 'formula', 'inputs', 'computedAt'];

/** 允许的数据来源。新增来源必须在此登记 —— 未登记即违规。 */
const SOURCES = ['tencent', 'sina', 'eastmoney', 'derived', 'user', 'fixture'];

/** 条件必填：窗口型指标必须声明 window（否则"MA5"无从判断是 5 天还是 5 周） */
const WINDOW_REQUIRED_HINT = /(^|_)(ma|ema|sma|rsi|kdj|boll|atr|donchian|rail|regression|channel|vol|avg)/i;

/* ---------------------------------------------------------------------------
 * 执行模式：两阶段迁移
 * ---------------------------------------------------------------------------
 * 契约一旦生效，**尚未补溯源的图层会被立刻拒绝渲染** —— 布林和导轨会当场消失。
 * 直接硬切会破坏正在工作的应用，所以分两阶段：
 *
 *   soft（默认，迁移期）—— 记录违规、在界面标注「未通过契约」，但**继续渲染**。
 *                          系统照常可用，违规清单在控制台与调试面板可见。
 *   hard（迁移完成）    —— 不合格直接拒绝渲染，并给出可见的拒绝理由。
 *
 * 阶段切换的条件很明确：scripts/verify-provenance-contract.js 报 24/24 合规。
 * **闸门是硬的，渲染是软的** —— 这样既不让契约形同虚设，
 * 也不让"补齐溯源"这件事阻塞整个应用。
 * ------------------------------------------------------------------------- */

let MODE = 'soft';

function setMode(m) { MODE = (m === 'hard') ? 'hard' : 'soft'; }
function getMode() { return MODE; }

/* ---------------------------------------------------------------------------
 * 违规登记表
 * ---------------------------------------------------------------------------
 * 拒绝渲染时必须留痕。否则"图层没画出来"又会变成一条新的静默通路 ——
 * 用户看到空白，不知道是数据没有、还是契约拒绝、还是代码坏了。
 * ------------------------------------------------------------------------- */

const registry = [];

function resetRegistry() { registry.length = 0; }

function record(entry) {
  registry.push({
    at: new Date().toISOString(),
    path: entry.path,
    field: entry.field,
    code: entry.code,
    detail: entry.detail,
  });
  return null;
}

function getRegistry() { return registry.slice(); }

function registrySummary() {
  const byCode = {};
  const byPath = {};
  registry.forEach((r) => {
    byCode[r.code] = (byCode[r.code] || 0) + 1;
    if (r.path) byPath[r.path] = (byPath[r.path] || 0) + 1;
  });
  return { total: registry.length, byCode, byPath };
}

/* ---------------------------------------------------------------------------
 * 校验
 * ------------------------------------------------------------------------- */

/**
 * 校验一个溯源信封。
 * @param {*} env     待校验的溯源对象
 * @param {object} ctx 上下文 { path, field, value, windowHint }
 * @returns {{ok: boolean, violations: Array<{code:string, detail:string}>}}
 */
function validate(env, ctx = {}) {
  const v = [];
  const path = ctx.path || '(未命名)';

  if (env == null || typeof env !== 'object') {
    v.push({ code: 'NO_PROVENANCE', detail: path + '：未携带溯源信息' });
    return { ok: false, violations: v };
  }

  /* 1. 必填字段 */
  REQUIRED_FIELDS.forEach((f) => {
    const val = env[f];
    const missing = val == null
      || (typeof val === 'string' && val.trim() === '')
      || (Array.isArray(val) && val.length === 0);
    if (missing) v.push({ code: 'MISSING_FIELD', detail: path + '：缺少必填字段 ' + f });
  });

  /* 2. 来源必须已登记 */
  if (env.source != null && SOURCES.indexOf(env.source) < 0) {
    v.push({ code: 'UNKNOWN_SOURCE', detail: path + '：未登记的数据来源 "' + env.source + '"' });
  }

  /* 3. derived 必须给出依赖字段 —— 派生值不可追溯等于凭空产生 */
  if (env.source === 'derived' && (!Array.isArray(env.inputs) || env.inputs.length === 0)) {
    v.push({ code: 'DERIVED_WITHOUT_INPUTS', detail: path + '：source=derived 但未声明 inputs' });
  }

  /* 4. 时点一致性：数据时点不得晚于计算时刻 */
  if (env.asOf && env.computedAt) {
    const a = Date.parse(String(env.asOf).replace(/-/g, '/'));
    const c = Date.parse(String(env.computedAt).replace(/-/g, '/'));
    if (Number.isFinite(a) && Number.isFinite(c) && a > c + 60 * 1000) {
      v.push({ code: 'ASOF_AFTER_COMPUTED', detail: path + '：数据时点晚于计算时刻（' + env.asOf + ' > ' + env.computedAt + '）' });
    }
  }

  /* 5. 窗口型指标必须声明 window —— 这是"周线用日线参数"那类缺陷的唯一拦截点 */
  const nameHint = ctx.field || path;
  if (WINDOW_REQUIRED_HINT.test(String(nameHint)) && env.window == null) {
    v.push({ code: 'MISSING_WINDOW', detail: path + '：窗口型指标未声明 window（无法判断 MA5 是 5 天还是 5 周）' });
  }

  /* 6. 公式必须是人可读的表达式，不是占位符 */
  if (typeof env.formula === 'string' && /^(todo|tbd|n\/a|-)$/i.test(env.formula.trim())) {
    v.push({ code: 'PLACEHOLDER_FORMULA', detail: path + '：formula 是占位符，未给出真实计算式' });
  }

  return { ok: v.length === 0, violations: v };
}

/**
 * 准入守卫 —— 渲染管线的唯一入口。
 *
 * hard 模式：合格返回信封；不合格登记违规并返回 **null**，
 *            调用方据此拒绝渲染并给出可见理由。
 * soft 模式：始终返回传入值（登记违规但放行），用于迁移期。
 *
 * 返回 null 而非抛错：渲染管线不应因为一个图层不合规而整页崩掉，
 * 但也绝不能静默跳过 —— 调用方必须处理 null 并显示拒绝理由。
 */
function guard(env, ctx = {}) {
  const r = validate(env, ctx);
  if (r.ok) return env;
  const first = r.violations[0];
  record({ path: ctx.path, field: ctx.field, code: first.code, detail: first.detail });
  return MODE === 'hard' ? null : env;
}

/**
 * 强制守卫 —— 无论当前模式如何，不合格一律拒绝。
 * 用于"这条路径绝不能放行"的场景（如新增图层、合规性关键路径）。
 */
function guardStrict(env, ctx = {}) {
  const r = validate(env, ctx);
  if (r.ok) return env;
  const first = r.violations[0];
  record({ path: ctx.path, field: ctx.field, code: first.code, detail: first.detail });
  return null;
}

/**
 * 便捷包装：把裸值 + 溯源信息组装成信封。
 * 指标模块应当用它构造返回值，而不是手写对象 —— 手写必然漏字段。
 */
function wrap(value, provenance) {
  const env = Object.assign({ value: value }, provenance || {});
  return env;
}

/**
 * 取信封里的实际值；若传入的是裸值（未包装），返回 null 并登记违规。
 * 供渲染管线读取指标值时使用，确保"读到的每个值都经过契约"。
 */
function unwrap(env, ctx = {}) {
  if (guard(env, ctx) === null) return null;
  return env.value;
}

/* ---------------------------------------------------------------------------
 * 渲染管线拒绝渲染时的可见文案
 * ------------------------------------------------------------------------- */

const REASON_TEXT = {
  NO_PROVENANCE: '该图层未携带溯源信息',
  MISSING_FIELD: '该图层溯源信息不完整',
  UNKNOWN_SOURCE: '该图层的数据来源未登记',
  DERIVED_WITHOUT_INPUTS: '该图层为派生值但未声明依赖字段',
  ASOF_AFTER_COMPUTED: '该图层的数据时点晚于计算时刻',
  MISSING_WINDOW: '该图层未声明窗口参数，口径无法确定',
  PLACEHOLDER_FORMULA: '该图层的计算式是占位符',
};

function reasonText(code) { return REASON_TEXT[code] || '该图层未通过溯源契约校验'; }

module.exports = {
  REQUIRED_FIELDS, SOURCES,
  validate, guard, guardStrict, wrap, unwrap,
  setMode, getMode,
  resetRegistry, getRegistry, registrySummary, reasonText,
};
