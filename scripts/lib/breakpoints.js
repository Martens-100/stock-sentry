'use strict';
/**
 * 断点 → 测试视口的唯一推导来源
 * ==============================
 *
 * 为什么需要这个文件
 * ------------------
 * 像素闸门（scripts/verify-v1-v7.js 的 V4/V5）原先在代码里写死两个视口：
 * 1440×900 与 360×780。而 CSS 的响应式断点是 1200 / 860·861 / 620·619 / 560。
 * 两个视口只落在最宽和最窄两端，**620–1200 的整个平板区间从未被测** ——
 * 那里的布局塌陷会一路漏到线上，且不会有任何报错。
 *
 * 这属于"派生值未从规范推导"：测试输入本应由 CSS 断点算出，却手工写死。
 * 后果是断点改了测试不知道，测试永远不会红。
 *
 * 现在由本文件从 public/style.css 解析断点并自动生成视口矩阵 ——
 * 断点一改，测试视口自动跟着变，推导关系被建立起来。
 *
 * 注意：本项目不使用 Tailwind（硬约束是原生 Canvas + 零 CDN），
 * 所以断点的唯一来源就是 style.css 里的 @media 规则，没有第二处声明。
 */
const fs = require('fs');

const DEFAULT_HEIGHT = 900;

/**
 * 解析 CSS 里所有 @media 条件中的宽度断点。
 * 只取 @media 前置条件里的 (max|min)-width，避免误伤普通样式里的 max-width
 * （例如 .empty{max-width:430px} 那是版式约束，不是响应式断点）。
 * @returns {number[]} 升序去重的断点值
 */
function parseBreakpoints(cssPath) {
  const css = fs.readFileSync(cssPath, 'utf8');
  const set = new Set();
  const mediaRe = /@media([^{]+)\{/g;
  let m;
  while ((m = mediaRe.exec(css))) {
    const widthRe = /(?:max|min)-width\s*:\s*(\d+)px/g;
    let w;
    while ((w = widthRe.exec(m[1]))) set.add(+w[1]);
  }
  return [...set].sort((a, b) => a - b);
}

/**
 * 折叠相邻断点。
 * CSS 里 "max-width:860" 与 "min-width:861" 是**同一个边界**的两种写法，
 * 展开成 4 个视口（859/860/861/862）毫无意义 —— 它们落在同一个分支里。
 * 因此把差值 ≤ 1 的断点合并成一个边界。
 */
function collapseAdjacent(sorted) {
  const out = [];
  for (const b of sorted) {
    if (out.length && b - out[out.length - 1] <= 1) continue;
    out.push(b);
  }
  return out;
}

/**
 * 生成测试视口矩阵：每个断点边界的上下各取一个，再加最宽/最窄两端。
 * @returns {Array<{width:number,height:number,why:string}>} 按宽度降序
 */
function viewportsFor(cssPath, opts = {}) {
  const height = opts.height || DEFAULT_HEIGHT;
  const widest = opts.widest || 1440;
  const narrowest = opts.narrowest || 360;
  const bounds = collapseAdjacent(parseBreakpoints(cssPath));

  const list = [];
  const add = (width, why) => {
    if (width <= 0) return;
    if (list.some((v) => v.width === width)) return;   // 去重：相邻断点会产生同值
    list.push({ width, height, why });
  };

  add(widest, '最宽分支');
  for (const b of bounds) {
    add(b + 1, `断点 ${b} 之上`);
    add(b - 1, `断点 ${b} 之下`);
  }
  add(narrowest, '最窄分支');

  return list.sort((a, b) => b.width - a.width);
}

module.exports = { parseBreakpoints, collapseAdjacent, viewportsFor, DEFAULT_HEIGHT };
