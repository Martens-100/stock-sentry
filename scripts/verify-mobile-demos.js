'use strict';
/**
 * 在真 WebKit（Safari 内核）+ iPhone 视口下核查四套移动端原型：
 * ① 关键计算样式是否真的切到移动布局（媒体查询有没有被 BASE 覆盖）
 * ② 核心交互是否点得通（换股 / 开抽屉 / 展窄轨 / 切页）
 * ③ 是否横向溢出、有无脚本异常；并逐页截图。
 *
 * 为什么必须看渲染与点击结果而不是只读 CSS：媒体查询是否命中、同特异性规则
 * 谁覆盖谁，只有浏览器算完才作数；交互更是点了才知道。
 *
 * 用法：node scripts/verify-mobile-demos.js
 */
const path = require('path');
const fs = require('fs');
const { webkit, devices } = require('playwright');

const DIR = path.join(__dirname, '..', 'out', 'mobile-options');
const SHOT = path.join(DIR, '_shots');

(async () => {
  fs.mkdirSync(SHOT, { recursive: true });
  const browser = await webkit.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 15'] });
  let pass = 0, fail = 0;
  const check = (ok, label) => { if (ok) { pass++; console.log('  ✅ ' + label); } else { fail++; console.log('  ❌ ' + label); } };

  const open = async (file) => {
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e).split('\n')[0]));
    await page.goto('file://' + path.join(DIR, file), { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(350);
    return { page, errs };
  };

  /* ---------------- A · 顶部吸顶胶囊条 ---------------- */
  {
    const { page, errs } = await open('A-top-chips.html');
    console.log('\n=== A-top-chips.html ===');
    const s = await page.evaluate(() => {
      const sb = document.querySelector('.sidebar');
      const cs = getComputedStyle(sb);
      return {
        sidebarPos: cs.position, sidebarW: Math.round(sb.getBoundingClientRect().width),
        wlDir: getComputedStyle(document.querySelector('.watchlist')).flexDirection,
        delOpacity: getComputedStyle(document.querySelector('.wl-del')).opacity,
        scoreShown: getComputedStyle(document.querySelector('.wl-score')).display,
        docW: document.documentElement.scrollWidth, vw: window.innerWidth,
        addHidden: getComputedStyle(document.querySelector('.add-block')).display
      };
    });
    check(s.sidebarPos === 'sticky' && s.sidebarW === s.vw, '侧栏变为整宽吸顶条（' + s.sidebarW + 'px, ' + s.sidebarPos + '）');
    check(s.wlDir === 'row', '自选改为横向排列');
    check(s.delOpacity === '1', '移除按钮常显（触屏可达）');
    check(s.scoreShown === 'none', '胶囊内不显示评分（信息密度控制）');
    check(s.addHidden === 'none', '搜索框默认收起');
    check(s.docW <= s.vw + 2, '无横向溢出');
    check(errs.length === 0, '无脚本异常');

    await page.click('.wl-item:nth-child(2)');
    await page.waitForTimeout(150);
    const n = await page.textContent('#sName');
    check(n.trim() === '科伦药业', '点第 2 个胶囊切到「科伦药业」（实际：' + n.trim() + '）');

    await page.click('#chipAdd');
    await page.waitForTimeout(150);
    const searching = await page.evaluate(() => document.querySelector('.sidebar').classList.contains('searching'));
    const addShown = await page.evaluate(() => getComputedStyle(document.querySelector('.add-block')).display);
    check(searching && addShown !== 'none', '点「＋」展开搜索框');
    check(errs.length === 0, '交互后仍无脚本异常');
    await page.screenshot({ path: path.join(SHOT, 'A-top-chips.png') });
    await page.close();
  }

  /* ---------------- B · 底部抽屉 ---------------- */
  {
    const { page, errs } = await open('B-bottom-sheet.html');
    console.log('\n=== B-bottom-sheet.html ===');
    const s = await page.evaluate(() => {
      const sb = document.querySelector('.sidebar');
      return {
        pos: getComputedStyle(sb).position,
        hCollapsed: Math.round(sb.getBoundingClientRect().height),
        itemsShown: Array.prototype.filter.call(document.querySelectorAll('.wl-item'),
          (el) => getComputedStyle(el).display !== 'none').length,
        docW: document.documentElement.scrollWidth, vw: window.innerWidth
      };
    });
    check(s.pos === 'fixed', '抽屉固定在底部');
    check(s.itemsShown === 1, '收起时只露出 1 条自选（实际 ' + s.itemsShown + '）');
    check(s.hCollapsed <= 160, '收起态高度受控（' + s.hCollapsed + 'px）');
    check(s.docW <= s.vw + 2, '无横向溢出');
    check(errs.length === 0, '无脚本异常');

    await page.click('#sheetToggle');
    await page.waitForTimeout(400);
    const opened = await page.evaluate(() => {
      const sb = document.querySelector('.sidebar');
      return {
        open: sb.classList.contains('open'),
        h: Math.round(sb.getBoundingClientRect().height),
        itemsShown: Array.prototype.filter.call(document.querySelectorAll('.wl-item'),
          (el) => getComputedStyle(el).display !== 'none').length,
        btn: document.getElementById('sheetToggle').textContent
      };
    });
    check(opened.open && opened.h > s.hCollapsed, '点「展开」抽屉变高（' + s.hCollapsed + ' → ' + opened.h + 'px）');
    check(opened.itemsShown === 3, '展开后显示全部 3 条自选');
    check(opened.btn === '收起', '按钮文案切换为「收起」');
    await page.screenshot({ path: path.join(SHOT, 'B-bottom-sheet.png') });
    await page.close();
  }

  /* ---------------- C · 左侧可折叠窄轨 ---------------- */
  {
    const { page, errs } = await open('C-collapsible-rail.html');
    console.log('\n=== C-collapsible-rail.html ===');
    const s = await page.evaluate(() => {
      const sb = document.querySelector('.sidebar');
      return {
        w: Math.round(sb.getBoundingClientRect().width),
        rail: getComputedStyle(document.querySelector('.rail')).display,
        wlDel: getComputedStyle(document.querySelector('.wl-del')).opacity,
        docW: document.documentElement.scrollWidth, vw: window.innerWidth
      };
    });
    check(s.w === 54, '默认折为 54px 窄轨（实际 ' + s.w + 'px）');
    check(s.rail === 'flex', '窄轨内容可见');
    check(s.wlDel === '1', '展开后的移除按钮可触达');
    check(s.docW <= s.vw + 2, '无横向溢出');
    check(errs.length === 0, '无脚本异常');

    await page.click('#railToggle');
    await page.waitForTimeout(250);
    const opened = await page.evaluate(() => {
      const sb = document.querySelector('.sidebar');
      return { open: sb.classList.contains('open'), w: Math.round(sb.getBoundingClientRect().width) };
    });
    check(opened.open && opened.w === 270, '点 › 展为 270px 覆盖层（实际 ' + opened.w + 'px）');
    await page.screenshot({ path: path.join(SHOT, 'C-rail-open.png') });

    await page.mouse.click(330, 600);
    await page.waitForTimeout(250);
    const closed = await page.evaluate(() => document.querySelector('.sidebar').classList.contains('open'));
    check(!closed, '点空白处自动收起');
    await page.screenshot({ path: path.join(SHOT, 'C-collapsible-rail.png') });
    await page.close();
  }

  /* ---------------- D · 顶部双标签分页 ---------------- */
  {
    const { page, errs } = await open('D-top-tabs.html');
    console.log('\n=== D-top-tabs.html ===');
    const s = await page.evaluate(() => ({
      pane: document.body.getAttribute('data-pane'),
      contentVisible: getComputedStyle(document.querySelector('.content')).display,
      sheetVisible: getComputedStyle(document.querySelector('.sidebar .sheet-body')).display,
      activeTab: (document.querySelector('.seg button.active') || {}).textContent,
      docW: document.documentElement.scrollWidth, vw: window.innerWidth
    }));
    check(s.pane === 'list', '默认落在「自选」页');
    check(s.contentVisible === 'none' && s.sheetVisible !== 'none', '自选页只显示列表，隐藏详情');
    check((s.activeTab || '').indexOf('自选') === 0, '「自选」标签高亮');
    check(s.docW <= s.vw + 2, '无横向溢出');
    check(errs.length === 0, '无脚本异常');

    await page.click('.seg button[data-pane="detail"]');
    await page.waitForTimeout(200);
    const d = await page.evaluate(() => ({
      pane: document.body.getAttribute('data-pane'),
      contentVisible: getComputedStyle(document.querySelector('.content')).display,
      sheetVisible: getComputedStyle(document.querySelector('.sidebar .sheet-body')).display
    }));
    check(d.pane === 'detail' && d.contentVisible !== 'none' && d.sheetVisible === 'none',
      '切「详情」后显示详情、隐藏列表');
    await page.screenshot({ path: path.join(SHOT, 'D-top-tabs-detail.png') });

    await page.click('.seg button[data-pane="list"]');
    await page.waitForTimeout(200);
    await page.click('.wl-item:nth-child(3)');
    await page.waitForTimeout(250);
    const auto = await page.evaluate(() => ({
      pane: document.body.getAttribute('data-pane'),
      name: (document.querySelector('#sName') || {}).textContent
    }));
    check(auto.pane === 'detail' && auto.name.trim() === '宁德时代',
      '列表里点一只自动进入详情（' + auto.name.trim() + '）');
    await page.screenshot({ path: path.join(SHOT, 'D-top-tabs.png') });
    await page.close();
  }

  /* ---------------- 总览页 ---------------- */
  {
    const { page, errs } = await open('index.html');
    console.log('\n=== index.html ===');
    const s = await page.evaluate(() => ({
      frames: document.querySelectorAll('iframe').length,
      docW: document.documentElement.scrollWidth, vw: window.innerWidth
    }));
    check(s.frames === 4, '总览页含 4 个方案预览框');
    check(s.docW <= s.vw + 2, '总览页在手机上也无横向溢出');
    check(errs.length === 0, '无脚本异常');
    await page.screenshot({ path: path.join(SHOT, 'index.png') });
    await page.close();
  }

  await browser.close();
  console.log(`\n${fail === 0 ? '✅ 全部通过' : '❌ 有失败项'}：通过 ${pass} 项，失败 ${fail} 项`);
  console.log('截图目录：out/mobile-options/_shots/');
  process.exit(fail === 0 ? 0 : 2);
})().catch((e) => { console.error('测试异常：', e.message); process.exit(1); });
