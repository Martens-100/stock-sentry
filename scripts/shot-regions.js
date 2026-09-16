'use strict';
/**
 * 把关键区域直接截出来看：省掉「用文字描述图像」这一层。
 * 用法：NODE_PATH=... node scripts/shot-regions.js [http(s) url]
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { webkit, devices } = require('playwright');

const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const SHOTS = path.join(ROOT, '_shots');
const REMOTE_URL = process.argv.slice(2).find((a) => /^https?:\/\//.test(a)) || null;
const TAG = REMOTE_URL ? 'live' : 'local';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      const file = path.join(DOCS, url === '/' ? 'index.html' : url.replace(/^\/+/, ''));
      if (!file.startsWith(DOCS) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const { srv, port } = REMOTE_URL ? { srv: null, port: 0 } : await serve();
  const base = REMOTE_URL || `http://127.0.0.1:${port}/`;
  const browser = await webkit.launch();

  for (const mode of ['mobile', 'desktop']) {
    const ctx = await browser.newContext(mode === 'mobile' ? { ...devices['iPhone 15'] } : { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    // 展开两张图（移动端默认折叠）
    if (mode === 'mobile') {
      await page.evaluate(() => document.querySelectorAll('.chart-toggle').forEach((b) => b.click()));
      await page.waitForTimeout(800);
    }
    // 让「轨道研判」卡片完整进入视口（它是 canvas 之外的另一处“图像”）
    await page.evaluate(() => document.querySelector('.channel-card')?.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(400);
    const card = await page.$('.channel-card');
    if (card) await card.screenshot({ path: path.join(SHOTS, `region-channel-${mode}-${TAG}.png`) });

    await page.evaluate(() => document.querySelector('.chart-kline')?.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(400);
    const kc = await page.$('.chart-kline');
    if (kc) await kc.screenshot({ path: path.join(SHOTS, `region-kline-${mode}-${TAG}.png`) });

    const mc = await page.$('.chart-minute');
    if (mc) { await page.evaluate(() => document.querySelector('.chart-minute')?.scrollIntoView({ block: 'start' })); await page.waitForTimeout(300); await mc.screenshot({ path: path.join(SHOTS, `region-minute-${mode}-${TAG}.png`) }); }

    console.log(`${mode}: 截图完成  异常=${errs.length ? errs.join(' | ') : '无'}`);
    await ctx.close();
  }
  await browser.close();
  if (srv) srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
