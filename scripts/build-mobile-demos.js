'use strict';
/**
 * 生成 4 个移动端布局方案的可交互 HTML 原型（+ 一个总览对比页）。
 *
 * 为什么这么做：设计取舍光看示意图判断不了 —— 必须点得动、能读到真实密度的内容
 * 才知道顺手不顺手。原型复用 public/style.css 的真实配色与卡片样式，
 * 内置示例数据，因此**离线可用、可直接发到手机上打开**。
 *
 * 每个方案：桌面宽度下保持现有双栏（证明「桌面零改动」），
 * 窄屏（<860px）下切到该方案的移动布局。iframe 以 390px 加载时即呈现移动形态。
 *
 * 用法：node scripts/build-mobile-demos.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'out', 'mobile-options');
const BASE = fs.readFileSync(path.join(ROOT, 'public', 'style.css'), 'utf8');

const STOCKS = [
  { code: '000063', name: '中兴通讯', price: '32.37', chg: '+1.20%', up: true, score: 48, action: '观望等待', src: '投研画像' },
  { code: '002422', name: '科伦药业', price: '26.10', chg: '-0.60%', up: false, score: 56, action: '逢低分批', src: '投研画像' },
  { code: '300750', name: '宁德时代', price: '305.48', chg: '+2.40%', up: true, score: 20, action: '减仓规避', src: '自动画像' }
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ---------------- 公共片段 ---------------- */

function wlItem(s, active) {
  return '<div class="wl-item' + (active ? ' active' : '') + '" data-code="' + s.code + '">'
    + '<div class="wl-row1"><span class="wl-name">' + esc(s.name) + '</span>'
    + '<span class="wl-chg ' + (s.up ? 'up' : 'down') + '">' + s.chg + '</span></div>'
    + '<div class="wl-row2"><span class="wl-code">' + s.code + '</span>'
    + '<span class="wl-score">评分 ' + s.score + '</span>'
    + '<button class="wl-del" title="移除">移除</button></div>'
    + '</div>';
}

function watchlist(activeCode, append) {
  return STOCKS.map((s) => wlItem(s, s.code === activeCode)).join('') + (append || '');
}

/** 分时走势用内联 SVG 画，避免依赖 canvas 与脚本 */
function minuteChart(w, h) {
  const pts = [22, 20, 24, 21, 26, 23, 28, 25, 27, 30, 26, 29, 32, 30, 33, 31, 34, 32, 33, 35, 32, 34, 36, 33, 35, 37, 34, 36, 38, 36];
  const max = 42, min = 16;
  const step = w / (pts.length - 1);
  const y = (v) => h - ((v - min) / (max - min)) * h;
  let d = '';
  pts.forEach((v, i) => { d += (i ? ' L' : 'M') + (i * step).toFixed(1) + ' ' + y(v).toFixed(1); });
  return '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" style="width:100%;height:' + h + 'px;display:block">'
    + '<line x1="0" y1="' + (h * 0.34).toFixed(1) + '" x2="' + w + '" y2="' + (h * 0.34).toFixed(1) + '" stroke="#e5e7eb" stroke-width="1" stroke-dasharray="4 4"/>'
    + '<path d="' + d + '" fill="none" stroke="#2450a4" stroke-width="1.6" stroke-linejoin="round"/>'
    + '</svg>';
}

/** 详情区（桌面与移动共用同一份真实结构） */
function detail(s) {
  const upCls = s.up ? 'up' : 'down';
  return ''
  + '<div class="stock-head card">'
  +   '<div class="sh-left">'
  +     '<div class="sh-name"><h2 id="sName">' + esc(s.name) + '</h2>'
  +       '<span class="code" id="sCode">' + s.code + '</span>'
  +       '<span class="tags"><i class="tag">A股</i><i class="tag">' + esc(s.src) + '</i></span></div>'
  +     '<div class="sh-price"><span class="price" id="sPrice">' + s.price + '</span>'
  +       '<span class="change ' + upCls + '" id="sChange">' + s.chg + '</span></div>'
  +     '<div class="sh-time" id="sTime">2026-09-16 15:36:00 · 已收盘</div>'
  +   '</div>'
  +   '<div class="sh-stats">'
  +     '<div class="stat"><span>今开</span><b>32.05</b></div>'
  +     '<div class="stat"><span>最高</span><b>32.52</b></div>'
  +     '<div class="stat"><span>最低</span><b>32.00</b></div>'
  +     '<div class="stat"><span>换手</span><b>1.83%</b></div>'
  +     '<div class="stat"><span>成交额</span><b>14.3 亿</b></div>'
  +     '<div class="stat"><span>流通市值</span><b>1548 亿</b></div>'
  +     '<div class="stat"><span>PE(TTM)</span><b>18.4</b></div>'
  +     '<div class="stat"><span>量比</span><b>0.92</b></div>'
  +   '</div>'
  + '</div>'

  + '<div class="grid-2">'
  +   '<div class="card verdict">'
  +     '<div class="card-title">盯盘结论</div>'
  +     '<div class="verdict-main">'
  +       '<div class="gauge"><svg viewBox="0 0 120 120">'
  +         '<circle cx="60" cy="60" r="52" fill="none" stroke="#eef0f3" stroke-width="12"/>'
  +         '<circle cx="60" cy="60" r="52" fill="none" stroke="#2450a4" stroke-width="12" stroke-linecap="round"'
  +           ' stroke-dasharray="' + (2 * Math.PI * 52).toFixed(0) + '" stroke-dashoffset="' + (2 * Math.PI * 52 * (1 - s.score / 100)).toFixed(0) + '"'
  +           ' transform="rotate(-90 60 60)"/>'
  +       '</svg><div class="gauge-num"><b>' + s.score + '</b><small>综合评分</small></div></div>'
  +       '<div class="verdict-body"><div class="action-label">' + esc(s.action) + '</div>'
  +         '<div class="action-desc">方向不明或处于左侧磨底，等待右侧确认信号</div>'
  +         '<div class="score-bars">'
  +           '<div class="sb"><span>技术面</span><div class="bar"><i style="width:39%"></i></div><b>39</b></div>'
  +           '<div class="sb"><span>策略面</span><div class="bar"><i style="width:56%"></i></div><b>56</b></div>'
  +           '<div class="sb"><span>置信度</span><div class="bar"><i style="width:24%"></i></div><b>24</b></div>'
  +         '</div></div>'
  +     '</div>'
  +     '<ul class="reasons">'
  +       '<li class="up">进入建仓区间：现价落入报告给定的建仓区间 32-35 元，具备左侧布局条件</li>'
  +       '<li class="up">主力资金净流入：当日主力净流入 4830 万元，尾盘有承接</li>'
  +       '<li class="down">量能不足：量比 0.92，上攻缺乏成交量配合</li>'
  +       '<li class="down">跌破 MA20：短期均线走平下压，趋势尚未修复</li>'
  +     '</ul>'
  +   '</div>'

  +   '<div class="card plan">'
  +     '<div class="card-title">交易计划</div>'
  +     '<div class="plan-grid">'
  +       '<div class="pg-item"><span>建仓区间</span><b>32.00 ~ 35.00</b></div>'
  +       '<div class="pg-item"><span>止损位</span><b>30.20</b></div>'
  +       '<div class="pg-item"><span>第一目标</span><b>38.50</b></div>'
  +       '<div class="pg-item"><span>仓位上限</span><b>15%</b></div>'
  +       '<div class="pg-item"><span>持仓周期</span><b>3 ~ 6 个月</b></div>'
  +       '<div class="pg-item"><span>风险收益比</span><b>1 : 2.4</b></div>'
  +     '</div>'
  +     '<div class="plan-batches"><div class="sub-title">分批建仓节奏</div>'
  +       '<table class="mini-table"><thead><tr><th>批次</th><th>价位</th><th>比例</th></tr></thead><tbody>'
  +       '<tr><td>第一批</td><td>32.00 ~ 33.00</td><td>40%</td></tr>'
  +       '<tr><td>第二批</td><td>33.00 ~ 34.00</td><td>35%</td></tr>'
  +       '<tr><td>第三批</td><td>34.00 ~ 35.00</td><td>25%</td></tr>'
  +       '</tbody></table></div>'
  +     '<div class="plan-levels"><div class="sub-title">关键支撑 / 阻力</div>'
  +       '<div class="level-list">'
  +         '<div class="lv"><span class="lv-k">压力 3</span><b>38.50</b></div>'
  +         '<div class="lv"><span class="lv-k">压力 2</span><b>36.20</b></div>'
  +         '<div class="lv"><span class="lv-k">压力 1</span><b>34.80</b></div>'
  +         '<div class="lv"><span class="lv-k">支撑 1</span><b>32.00</b></div>'
  +         '<div class="lv"><span class="lv-k">支撑 2</span><b>30.20</b></div>'
  +       '</div></div>'
  +   '</div>'
  + '</div>'

  + '<div class="card chart-card"><div class="card-title">分时走势'
  +   '<span class="chart-legend">价格 · 均价</span></div>' + minuteChart(600, 150) + '</div>'

  + '<div class="card"><div class="card-title">信号面板'
  +   '<div class="tabs"><button class="tab active">利好 <b>3</b></button><button class="tab">利空 <b>2</b></button>'
  +   '<button class="tab">中性 <b>1</b></button><button class="tab">全部 <b>6</b></button></div></div>'
  +   '<div class="signal-list">'
  +     '<div class="sig up"><b>利好</b><div><div class="sig-t">进入建仓区间</div>'
  +       '<div class="sig-d">现价 32.37 落入报告给定的建仓区间 32~35 元</div></div></div>'
  +     '<div class="sig up"><b>利好</b><div><div class="sig-t">主力资金净流入</div>'
  +       '<div class="sig-d">当日主力净流入 4830 万元，尾盘 14:30 后持续承接</div></div></div>'
  +     '<div class="sig down"><b>利空</b><div><div class="sig-t">跌破 MA20</div>'
  +       '<div class="sig-d">收盘价低于 20 日均线，短期趋势尚未修复</div></div></div>'
  +   '</div></div>'

  + '<div class="card"><div class="card-title">投研报告与持仓攻略'
  +   '<div class="report-actions"><button class="btn primary">生成报告</button>'
  +   '<button class="btn ghost">下载 HTML</button><button class="btn ghost">下载 Markdown</button></div></div>'
  +   '<div class="report-body" id="reportBody">'
  +     '<h3>执行摘要</h3>'
  +     '<p>中兴通讯是国内通信主设备龙头之一，业务覆盖运营商网络、政企业务与消费者业务。'
  +     '本报告基于公开行情与财务数据，从估值、经营拆解、筹码结构、风险控制四个维度给出持仓攻略。</p>'
  +     '<h3>财务与估值</h3>'
  +     '<p>当前 PE(TTM) 约 18.4 倍，处于近三年估值中枢的下沿。营业收入同比增速与净利率的匹配度'
  +     '是本标的最需要追踪的变量：若营收回升而毛利率不同步改善，则利润弹性有限。</p>'
  +     '<p>毛利率与净利率的季度环比变化，是判断经营质量的第一顺位指标。股东户数的变化则用于'
  +     '观察筹码是集中还是分散 —— 户数下降通常对应机构增持或散户离场。</p>'
  +     '<h3>经营拆解</h3>'
  +     '<p>运营商网络业务占比最高，受资本开支周期影响明显；政企业务增速较快但基数低，'
  +     '对整体营收的拉动需要连续多个季度验证。消费者业务受终端出货节奏影响，波动较大。</p>'
  +     '<h3>筹码结构</h3>'
  +     '<p>流通市值约 1548 亿元，换手率 1.83%，属于中等活跃度。前十大流通股东中机构占比的变化'
  +     '需要与季度财报同步更新，目前该项数据尚未接入自动取数，需要人工核对。</p>'
  +     '<h3>风险控制</h3>'
  +     '<p>止损位设在 30.20 元，对应建仓区间下沿约 6% 的回撤容忍度。单票仓位上限 15%，'
  +     '分批建仓以摊薄成本。若有效跌破支撑 2，应无条件执行止损，不做向下补仓。</p>'
  +     '<h3>持仓攻略</h3>'
  +     '<p>第一批建仓 40% 落在 32.00~33.00 元区间；第二批 35% 落在 33.00~34.00；'
  +     '第三批 25% 落在 34.00~35.00。目标价 38.50 元对应约 19% 上行空间，风险收益比约 1:2.4。</p>'
  +     '<p>本段之后的内容涉及业绩节奏与团队研判 —— 报告实际长度约 8000~9000 字，'
  +     '在手机上需要连续下滑较长时间才能读完，这正是移动端布局要优先照顾的场景。</p>'
  +     '<h3>业绩节奏</h3>'
  +     '<p>需重点关注的披露节点包括季报、半年报与年报，以及运营商集采招标的公告节奏。'
  +     '业绩预告与快报往往先于正式财报发布，是更早的信号来源。</p>'
  +     '<h3>团队研判</h3>'
  +     '<p>管理层稳定性、研发投入强度与核心技术人员变动，是判断长期竞争力的软性指标。'
  +     '这类信息通常散落在年报与调研纪要中，需要人工整理。</p>'
  +   '</div></div>'

  + '<div class="disclaimer"><b>免责声明：</b>以上内容基于公开数据和量化分析，仅供参考，不构成投资建议。'
  + '市场有风险，投资需谨慎。</div>';
}

/* ---------------- 四套移动布局的覆盖样式 ---------------- */

const MOBILE_COMMON = `
@media (max-width:860px){
  .topbar{position:static;height:auto;padding:8px 12px;gap:8px;flex-wrap:nowrap}
  .brand p{display:none}
  .brand h1{font-size:15px}
  .topbar-right{gap:8px;margin-left:auto;flex-wrap:nowrap}
  .clock span{font-size:13px}
  .switch span{font-size:11.5px}
  .refresh-all{display:none}
  .btn{border-radius:9px;font-size:12px;padding:6px 10px}
  .content,.sidebar{min-width:0}
  .grid-2,.plan-grid,.profile-grid,.channel-grid{grid-template-columns:1fr !important}
  .sh-stats{grid-template-columns:repeat(2,1fr) !important;gap:8px 14px}
  .verdict-main{flex-direction:column;align-items:flex-start;gap:14px}
  .rv-row{grid-template-columns:88px 1fr 62px;gap:8px}
  .ch-advice{min-width:0}
  .wl-chg{flex:0 0 auto}
  .report-actions{flex-wrap:wrap;gap:6px}
}
`;

const OPTIONS = [
  {
    id: 'A',
    file: 'A-top-chips.html',
    title: '方案 A · 顶部吸顶胶囊条',
    tagline: '清单位于顶部横滑，内容区拿满整屏；一次点击换股且不丢滚动位置。',
    pros: ['内容区整宽，阅读不受挤压', '换股 1 次点击，滚动位置不丢', '与 Apple 股票 App 同构，用户不用学'],
    cons: ['标的很多时要横向滑动', '单条胶囊信息量有限（名称 / 价格 / 涨跌）'],
    css: MOBILE_COMMON + `
@media (max-width:860px){
  .layout{display:block;height:auto;overflow:visible}
  .sidebar{width:auto;border-right:0;background:#fff;border-bottom:1px solid var(--line);
    position:sticky;top:0;z-index:40;display:block;padding:8px 10px 6px}
  .side-block{margin:0}
  .side-block.grow{margin:0}
  .side-title{display:none}
  .add-block{display:none}
  .sidebar.searching .add-block{display:block;margin-bottom:8px}
  #searchResults{display:none}
  .search-row{margin-bottom:0}
  .watchlist{flex-direction:row;overflow-x:auto;gap:8px;padding-bottom:2px}
  .wl-item{flex:0 0 132px;padding:7px 9px;border-left:0;border-radius:9px;
    border-bottom:2px solid transparent}
  .wl-item.active{border-bottom-color:var(--accent);background:var(--accent-bg);border-color:#e5e7eb}
  .wl-del{opacity:1;font-size:11px;border:1px solid var(--line);border-radius:5px;padding:0 5px}
  .wl-score{display:none}
  .wl-row2{justify-content:space-between;align-items:center}
  .chip-add{flex:0 0 42px;border:1px dashed var(--line);background:#fbfbfc;border-radius:9px;
    color:var(--muted);font-size:16px;line-height:1}
  .content{overflow:visible;padding:12px 12px 48px}
}
`,
  },
  {
    id: 'B',
    file: 'B-bottom-sheet.html',
    title: '方案 B · 底部抽屉',
    tagline: '内容占满全屏，清单收进底部可上滑抽屉，能承载更多字段。',
    pros: ['内容区完全占满，沉浸阅读', '抽屉展开后能放更多字段与排序', '拇指可达性最好'],
    cons: ['抽屉展开会遮住内容，打断阅读', '需要处理手势与层级，改动量最大'],
    css: MOBILE_COMMON + `
@media (max-width:860px){
  .layout{display:block;height:auto;overflow:visible}
  .sidebar{position:fixed;left:0;right:0;bottom:0;width:auto;z-index:60;
    background:#fff;border-top:1px solid var(--line);border-right:0;
    border-radius:16px 16px 0 0;box-shadow:0 -6px 24px rgba(16,24,40,.10);
    max-height:72vh;overflow:hidden;display:flex;flex-direction:column;
    transition:max-height .22s ease}
  .sidebar .handle{height:20px;flex:0 0 20px;display:flex;align-items:center;justify-content:center}
  .sidebar .handle i{width:36px;height:4px;border-radius:99px;background:#d3d1c7;display:block}
  .sheet-head{display:flex;justify-content:space-between;align-items:center;padding:2px 12px 8px}
  .sheet-head .cur{font-size:13px;font-weight:600}
  .sidebar .sheet-body{flex:1;min-height:0;overflow:auto;padding:0 12px 14px}
  .sidebar:not(.open){max-height:126px}
  .sidebar:not(.open) .side-title{display:none}
  .sidebar:not(.open) .add-block{display:none}
  .sidebar:not(.open) .wl-item:nth-child(n+2){display:none}
  .watchlist{flex-direction:column;gap:6px}
  .wl-del{opacity:1}
  .content{overflow:visible;padding:12px 12px 180px}
}
`,
  },
  {
    id: 'C',
    file: 'C-collapsible-rail.html',
    title: '方案 C · 左侧可折叠窄轨',
    tagline: '默认折成 50px 窄轨，点开展为覆盖层；桌面端零改动。',
    pros: ['改动量最小，桌面端一行不动', '保留「清单在左侧」的心智模型', '窄轨常驻，随时可切'],
    cons: ['50px 内只能放 6 位代码，信息量低', '展开→选→收起是两次操作'],
    css: MOBILE_COMMON + `
@media (max-width:860px){
  .layout{display:flex;height:auto;overflow:visible;position:relative}
  .sidebar{width:54px;flex:0 0 54px;align-self:flex-start;position:sticky;top:0;
    max-height:100dvh;align-items:center;padding:6px 0;
    display:flex;flex-direction:column;gap:6px;overflow:hidden}
  .sidebar .side-block{display:none}
  .rail{display:flex;flex-direction:column;gap:8px;align-items:center;width:100%}
  .rail-toggle{width:40px;height:26px;border:1px solid #d5ddf2;background:var(--accent-bg);
    border-radius:7px;color:var(--accent);font-size:16px;line-height:1;padding:0;cursor:pointer}
  .rail-item{width:42px;border:1px solid var(--line);border-radius:7px;padding:5px 0;
    text-align:center;cursor:pointer;background:#fff}
  .rail-item.active{border-color:#d5ddf2;background:var(--accent-bg)}
  .rail-item .rc{font-size:10.5px;font-family:ui-monospace,Menlo,monospace;color:var(--ink);line-height:1.3}
  .rail-item .rp{font-size:10.5px;line-height:1.3}
  .sidebar.open{position:absolute;left:0;top:0;bottom:0;width:270px;flex:0 0 270px;
    max-height:none;z-index:70;box-shadow:4px 0 20px rgba(16,24,40,.14);background:#fff;padding:10px}
  .sidebar.open .side-block{display:block}
  .sidebar.open .rail{display:none}
  .wl-del{opacity:1}
  .content{overflow:visible;padding:12px 12px 48px}
}
`,
  },
  {
    id: 'D',
    file: 'D-top-tabs.html',
    title: '方案 D · 顶部双标签分页',
    tagline: '自选与详情拆成两页切换，清单页能放分值、信号计数、排序。',
    pros: ['清单页能承载最丰富的信息', '一屏一事，最符合移动端习惯', '详情阅读完全不被打断'],
    cons: ['换股要切两次（回列表→再进详情）', '与桌面形态差异最大'],
    css: MOBILE_COMMON + `
@media (max-width:860px){
  .layout{display:block;height:auto;overflow:visible}
  .sidebar{position:sticky;top:0;z-index:40;width:auto;border-right:0;background:#fff;
    border-bottom:1px solid var(--line);display:block;padding:8px 10px}
  .seg{display:flex;gap:6px;margin-bottom:8px}
  .seg button{flex:1;border:1px solid var(--line);background:#fbfbfc;border-radius:9px;
    padding:7px 0;font-size:12.5px;color:var(--muted)}
  .seg button.active{background:var(--accent-bg);border-color:#d5ddf2;color:var(--accent);font-weight:600}
  .side-title{display:none}
  #searchResults{display:none}
  .watchlist{flex-direction:column;gap:8px}
  .wl-item{padding:10px 12px}
  .wl-item.active{border-left:3px solid var(--accent)}
  .wl-del{opacity:1}
  .content{overflow:visible;padding:12px 12px 48px}
  body[data-pane="list"] .content{display:none}
  body[data-pane="detail"] .sidebar .sheet-body{display:none}
}
`
  }
];

/* ---------------- 组装页面 ---------------- */

function page(opt, bodyExtra, js, sideExtra) {
  const rail = STOCKS.map((s, i) => '<div class="rail-item' + (i === 0 ? ' active' : '') + '" data-code="' + s.code + '">'
    + '<div class="rc">' + s.code + '</div>'
    + '<div class="rp ' + (s.up ? 'up' : 'down') + '">' + s.chg.replace('%', '') + '</div></div>').join('');
  const railOpen = watchlist('000063', opt.id === 'A'
    ? '<button class="chip-add" id="chipAdd" title="添加标的">＋</button>' : '');

  return '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
    + '<title>' + esc(opt.title) + ' · StockSentry 移动端原型</title>\n'
    + '<style>\n' + BASE + '\n'
    + '.rail{display:none}.handle{display:none}.sheet-head{display:none}.list-pane{display:none}\n'
    + '.proto-note{background:#eef2fb;border:1px solid #d5ddf2;color:#2450a4;border-radius:10px;'
    + 'padding:9px 12px;font-size:12px;margin-bottom:12px;line-height:1.6}\n'
    + '.proto-note b{font-weight:600}\n'
    + opt.css + '\n'
    + '</style>\n</head>\n<body data-pane="detail">\n'
    + '<header class="topbar"><div class="brand"><div class="logo">S</div><div>'
    + '<h1>StockSentry</h1><p>智能盯盘 · 信号反馈 · 投研报告自动生成</p></div></div>'
    + '<div class="topbar-right"><div class="clock"><span id="clock">15:36:00</span>'
    + '<small id="marketState">已收盘</small></div>'
    + '<label class="switch"><input type="checkbox" checked><span>自动盯盘 <b>8</b>s</span></label>'
    + '<button class="btn ghost refresh-all">立即刷新</button></div></header>\n'
    + '<div class="proto-note">__NOTE__</div>\n'
    + '<main class="layout">\n'
    + '<aside class="sidebar" id="sidebar">\n'
    + '  <div class="handle" id="handle"><i></i></div>\n'
    + '  <div class="rail"><button class="rail-toggle" id="railToggle" title="展开清单">&#8250;</button>' + rail + '</div>\n'
    + (sideExtra || '')
    + '  <div class="sheet-body">\n'
    + '  <div class="sheet-head"><span class="cur" id="sheetCur">中兴通讯 32.37 +1.20%</span>'
    + '<button class="btn ghost" id="sheetToggle">展开</button></div>\n'
    + '  <div class="side-block add-block"><div class="side-title">添加标的</div>'
    + '<div class="search-row"><input type="text" placeholder="代码 / 名称 / 拼音" autocomplete="off">'
    + '<button class="btn primary">搜索</button></div></div>\n'
    + '  <div class="side-block grow"><div class="side-title">自选盯盘 <span class="pill">3</span></div>'
    + '<div class="watchlist">' + railOpen + '</div></div>\n'
    + '  </div>\n'
    + '</aside>\n'
    + '<section class="content">'
    + bodyExtra + detail(STOCKS[0]) + '</section>\n'
    + '</main>\n<script>\n' + js + '\n</script>\n</body>\n</html>\n';
}

/* 每个方案的交互脚本 */
const JS_BASE = ''
  + 'var DATA={' + STOCKS.map((s) => '"' + s.code + '":{n:"' + s.name + '",p:"' + s.price + '",c:"' + s.chg + '"}').join(',') + '};\n'
  + 'function pick(code){\n'
  + '  var d=DATA[code]; if(!d) return;\n'
  + '  var n=document.getElementById("sName"); if(n) n.textContent=d.n;\n'
  + '  var c=document.getElementById("sCode"); if(c) c.textContent=code;\n'
  + '  var p=document.getElementById("sPrice"); if(p) p.textContent=d.p;\n'
  + '  var g=document.getElementById("sChange"); if(g){g.textContent=d.c;g.className="change "+(d.c.charAt(0)==="+"?"up":"down");}\n'
  + '  var sc=document.getElementById("sheetCur"); if(sc) sc.textContent=d.n+" "+d.p+" "+d.c;\n'
  + '  Array.prototype.forEach.call(document.querySelectorAll("[data-code]"),function(el){\n'
  + '    el.classList.toggle("active", el.getAttribute("data-code")===code);\n'
  + '  });\n'
  + '  var body=document.body;\n'
  + '  if(body && body.getAttribute("data-pane")==="list" && window.PROTO_SWITCH) window.PROTO_SWITCH();\n'
  + '}\n'
  + 'document.addEventListener("click",function(e){\n'
  + '  var del=e.target.closest && e.target.closest(".wl-del");\n'
  + '  if(del){e.stopPropagation();var it=del.closest(".wl-item");if(it)it.style.display="none";return;}\n'
  + '  var it=e.target.closest && e.target.closest("[data-code]");\n'
  + '  if(it){pick(it.getAttribute("data-code"));}\n'
  + '});\n';

const JS_A = JS_BASE
  + 'var ca=document.getElementById("chipAdd"),sbA=document.getElementById("sidebar");\n'
  + 'if(ca)ca.addEventListener("click",function(e){e.stopPropagation();sbA.classList.toggle("searching");});\n';

const JS_B = JS_BASE
  + 'var sb=document.getElementById("sidebar"),st=document.getElementById("sheetToggle"),hd=document.getElementById("handle");\n'
  + 'function syncBtn(){if(st)st.textContent=sb.classList.contains("open")?"收起":"展开";}\n'
  + 'function toggle(){sb.classList.toggle("open");syncBtn();}\n'
  + 'if(st)st.addEventListener("click",toggle);\n'
  + 'if(hd)hd.addEventListener("click",toggle);\n'
  + 'syncBtn();\n';

const JS_C = JS_BASE
  + 'var sb=document.getElementById("sidebar"),rt=document.getElementById("railToggle");\n'
  + 'if(rt)rt.addEventListener("click",function(){sb.classList.toggle("open");});\n'
  + 'document.addEventListener("click",function(e){\n'
  + '  if(sb.classList.contains("open") && !sb.contains(e.target)) sb.classList.remove("open");\n'
  + '});\n';

const JS_D = JS_BASE
  + 'window.PROTO_SWITCH=function(){document.body.setAttribute("data-pane","detail");syncTabs();};\n'
  + 'function syncTabs(){\n'
  + '  var pane=document.body.getAttribute("data-pane");\n'
  + '  Array.prototype.forEach.call(document.querySelectorAll(".seg button"),function(b){\n'
  + '    b.classList.toggle("active", b.getAttribute("data-pane")===pane);\n'
  + '  });\n'
  + '}\n'
  + 'document.addEventListener("click",function(e){\n'
  + '  var b=e.target.closest && e.target.closest(".seg button");\n'
  + '  if(b){document.body.setAttribute("data-pane",b.getAttribute("data-pane"));syncTabs();}\n'
  + '});\n'
  + 'document.body.setAttribute("data-pane","list");\n'
  + 'syncTabs();\n';

/** 方案 D 的「自选」页顶部两段式切换 */
const SEG = '<div class="seg"><button data-pane="list">自选 3</button>'
  + '<button data-pane="detail">详情</button></div>';

function build() {
  fs.mkdirSync(OUT, { recursive: true });
  const written = [];

  OPTIONS.forEach((opt) => {
    if (opt.id === 'A') written.push(writeOpt(opt, '', '点「＋」可展开搜索框；点胶囊直接换股，吸顶不随内容滚走。', JS_A));
    if (opt.id === 'B') written.push(writeOpt(opt, '', '底部常驻一条当前标的条，点「展开」上滑出完整清单。', JS_B));
    if (opt.id === 'C') written.push(writeOpt(opt, '', '左侧窄轨常驻显示代码与涨跌，点左上角 › 展开完整清单，点空白处收起。', JS_C));
    if (opt.id === 'D') written.push(writeOpt(opt, '', '顶部两段式切换：先在「自选」页点一只，自动进入「详情」页读报告。', JS_D, SEG));
  });

  const idx = path.join(OUT, 'index.html');
  fs.writeFileSync(idx, buildIndex(), 'utf8');
  written.push(idx);

  console.log('\n移动端原型已生成 → out/mobile-options/');
  written.forEach((f) => {
    const s = fs.statSync(f).size;
    console.log('  ' + path.basename(f).padEnd(26) + (s / 1024).toFixed(1) + ' KB');
  });
  console.log('\n打开 index.html 可在一屏内横向对比四个方案；');
  console.log('单个 HTML 也可直接发到手机上打开（离线可用）。');
}

function writeOpt(opt, extraBody, hint, js, sideExtra) {
  const note = '<b>' + esc(opt.title) + '</b>　' + esc(hint) + '<br>'
    + esc(opt.tagline) + '　把窗口收窄到 860px 以下（或直接用手机打开）就是移动布局。';
  const full = page(opt, extraBody, js, sideExtra).replace('__NOTE__', () => note);
  const file = path.join(OUT, opt.file);
  fs.writeFileSync(file, full, 'utf8');
  return file;
}

function buildIndex() {
  const cards = OPTIONS.map((o) => ''
    + '<div style="flex:1;min-width:330px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:14px">'
    + '<div style="font-size:14px;font-weight:600;color:#15171c;margin-bottom:4px">' + esc(o.title) + '</div>'
    + '<div style="font-size:12.5px;color:#7a828f;line-height:1.6;margin-bottom:10px">' + esc(o.tagline) + '</div>'
    + '<div style="border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;background:#f4f5f7;width:390px;max-width:100%">'
    + '<iframe src="' + o.file + '" style="width:100%;height:720px;border:0;display:block" loading="lazy"></iframe>'
    + '</div>'
    + '<div style="display:flex;gap:16px;margin-top:12px">'
    + '<div style="flex:1"><div style="font-size:12px;font-weight:600;color:#12855a;margin-bottom:4px">优点</div>'
    + '<ul style="margin:0;padding-left:16px;font-size:12px;color:#3d434d;line-height:1.7">'
    + o.pros.map((p) => '<li>' + esc(p) + '</li>').join('') + '</ul></div>'
    + '<div style="flex:1"><div style="font-size:12px;font-weight:600;color:#d0342c;margin-bottom:4px">代价</div>'
    + '<ul style="margin:0;padding-left:16px;font-size:12px;color:#3d434d;line-height:1.7">'
    + o.cons.map((c) => '<li>' + esc(c) + '</li>').join('') + '</ul></div>'
    + '</div>'
    + '<div style="margin-top:12px"><a href="' + o.file + '" target="_blank" '
    + 'style="font-size:12.5px;color:#2450a4;text-decoration:none">单独打开这个方案 &#8599;</a>'
    + '<span style="font-size:12px;color:#7a828f;margin-left:10px">（也可把这个文件直接发到手机上打开）</span></div>'
    + '</div>').join('');
  return '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
    + '<title>StockSentry 移动端布局方案对比</title>\n<style>\n'
    + 'body{margin:0;background:#f4f5f7;color:#15171c;'
    + 'font:14px/1.6 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;padding:22px}\n'
    + 'h1{font-size:19px;margin:0 0 6px}\n'
    + '.lead{font-size:13px;color:#7a828f;max-width:900px;line-height:1.7;margin-bottom:6px}\n'
    + '.fixed{background:#fff;border:1px solid #e5e7eb;border-left:3px solid #d0342c;border-radius:10px;'
    + 'padding:10px 14px;font-size:12.5px;color:#3d434d;line-height:1.7;max-width:900px;margin:14px 0 20px}\n'
    + '.row{display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start}\n'
    + '</style>\n</head>\n<body>\n'
    + '<h1>移动端布局：四个方案的真实界面</h1>\n'
    + '<p class="lead">下面每个框都是<b>可点可滑的真界面</b>（真实配色 + 真实卡片 + 内置示例数据，离线可用）。'
    + '点标的能切换、点按钮能展开，请当作在手机上试。</p>\n'
    + '<div class="fixed"><b>四个方案之外，无论选哪个都要一起修的四件事：</b><br>'
    + '1. <code>.wl-del</code> 现在靠 <code>:hover</code> 显形 —— 触屏没有 hover，手机上根本删不掉自选股；<br>'
    + '2. <code>height:calc(100vh - 60px)</code> 在 iOS 动态工具栏下会偏高，应换 <code>100dvh</code>；<br>'
    + '3. 全站只有 1 条媒体查询（1200px），手机宽度下不做任何重排；<br>'
    + '4. K 线图固定 380px 高，在手机上占掉两屏，应响应式降高或默认折叠。</div>\n'
    + '<div class="row">' + cards + '</div>\n'
    + '</body>\n</html>\n';
}

build();
