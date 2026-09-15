'use strict';
/**
 * StockSentry 服务端（零依赖）
 * 静态托管 + REST API + SSE 实时推送
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const src = require('./lib/source');
const engine = require('./lib/engine');
const report = require('./lib/report');

const PORT = Number(process.env.PORT) || 8848;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const OUT = path.join(ROOT, 'out');
const WATCHLIST_FILE = path.join(ROOT, 'data', 'watchlist.json');

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

/* ------------------------- 自选股持久化 ------------------------- */
function readWatchlist() {
  try { return JSON.parse(fs.readFileSync(WATCHLIST_FILE, 'utf8')); }
  catch (_) { return { codes: ['000063', '002422', '000032'], refreshSec: 8 }; }
}
function writeWatchlist(w) {
  fs.writeFileSync(WATCHLIST_FILE, JSON.stringify(w, null, 2));
}

/* ------------------------- 工具 ------------------------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon'
};
function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
  res.end(body);
}
const sendJson = (res, obj, code = 200) => send(res, code, JSON.stringify(obj), 'application/json; charset=utf-8');

function serveStatic(req, res, pathname) {
  let p = pathname === '/' ? '/index.html' : pathname;
  const file = path.join(PUBLIC, path.normalize(p).replace(/^(\.\.[\/\\])+/, ''));
  if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    return send(res, 404, 'Not Found', 'text/plain; charset=utf-8');
  }
  send(res, 200, fs.readFileSync(file), MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
}

/* ------------------------- 路由 ------------------------- */
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const p = parsed.pathname;
  const q = parsed.query;

  try {
    /* --- 自选股 --- */
    if (p === '/api/watchlist' && req.method === 'GET') {
      const w = readWatchlist();
      const quotes = await src.getQuotes(w.codes).catch(() => ({}));
      const list = w.codes.map((c) => {
        const code = src.normalize(c).code;
        const quote = quotes[code] || null;
        const pf = engine.getProfile(code);
        return { code, name: quote?.name || pf?.name || code, hasProfile: !!pf, quote };
      });
      return sendJson(res, { ...w, list });
    }

    if (p === '/api/watchlist' && req.method === 'POST') {
      let body = '';
      req.on('data', (d) => { body += d; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const w = readWatchlist();
          if (payload.add) {
            const code = src.normalize(payload.add).code;
            if (!w.codes.includes(code)) w.codes.push(code);
          }
          if (payload.remove) {
            const code = src.normalize(payload.remove).code;
            w.codes = w.codes.filter((c) => c !== code);
          }
          if (payload.codes) w.codes = payload.codes.map((c) => src.normalize(c).code);
          writeWatchlist(w);
          sendJson(res, { ok: true, ...w });
        } catch (e) { sendJson(res, { ok: false, error: e.message }, 400); }
      });
      return;
    }

    /* --- 搜索 --- */
    if (p === '/api/search') {
      const rows = await src.searchStocks(String(q.q || '').trim());
      return sendJson(res, { ok: true, rows });
    }

    /* --- 完整分析 --- */
    if (p === '/api/analyze') {
      const code = String(q.code || '').trim();
      if (!code) return sendJson(res, { ok: false, error: '缺少 code 参数' }, 400);
      const data = await engine.analyze(code);
      return sendJson(res, { ok: true, data });
    }

    /* --- 批量分析（自选股盯盘） --- */
    if (p === '/api/scan') {
      const codes = String(q.codes || readWatchlist().codes.join(',')).split(',').filter(Boolean);
      const results = await Promise.all(codes.map(async (c) => {
        try { return await engine.analyze(c); }
        catch (e) { return { code: c, error: e.message }; }
      }));
      return sendJson(res, { ok: true, data: results, ts: Date.now() });
    }

    /* --- 报告生成 --- */
    if (p === '/api/report') {
      const code = String(q.code || '').trim();
      if (!code) return sendJson(res, { ok: false, error: '缺少 code 参数' }, 400);
      const data = await engine.analyze(code);
      const md = report.buildReport(data);
      const bodyHtml = report.mdToHtml(md);
      const html = report.standaloneHtml(`${data.name}（${data.code}）投研报告与持仓攻略`, bodyHtml);
      const stamp = new Date().toISOString().slice(0, 10);
      const base = path.join(OUT, `${data.code}_${data.name}_投研持仓攻略_${stamp}`);
      let saved = [];
      try {
        fs.writeFileSync(base + '.md', md, 'utf8');
        fs.writeFileSync(base + '.html', html, 'utf8');
        saved = [path.basename(base + '.html'), path.basename(base + '.md')];
      } catch (e) {
        console.warn('[server] 报告落盘失败（云端只读文件系统属正常）：', e.message);
      }

      if (q.format === 'html') {
        const headers = { 'Content-Type': 'text/html; charset=utf-8', 'Access-Control-Allow-Origin': '*' };
        if (q.download) headers['Content-Disposition'] = `attachment; filename="${encodeURIComponent(path.basename(base + '.html'))}"`;
        res.writeHead(200, headers);
        return res.end(html);
      }
      return sendJson(res, {
        ok: true, code: data.code, name: data.name, md, bodyHtml,
        htmlPath: saved[0] ? base + '.html' : null, mdPath: saved[1] ? base + '.md' : null,
        files: saved
      });
    }

    /* --- SSE 实时推送 --- */
    if (p === '/api/stream') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      const codes = String(q.codes || readWatchlist().codes.join(',')).split(',').filter(Boolean);
      let alive = true;
      req.on('close', () => { alive = false; });

      const tick = async () => {
        if (!alive) return;
        try {
          const quotes = await src.getQuotes(codes);
          const rows = codes.map((c) => {
            const code = src.normalize(c).code;
            const qt = quotes[code];
            return qt ? {
              code, name: qt.name, price: qt.price, changePct: qt.changePct != null ? +qt.changePct.toFixed(2) : null,
              turnover: qt.turnover, volumeRatio: qt.volumeRatio, amount: qt.amount,
              high: qt.high, low: qt.low, open: qt.open, preClose: qt.preClose, time: qt.time
            } : { code, error: true };
          });
          res.write(`data: ${JSON.stringify({ ts: Date.now(), rows })}\n\n`);
        } catch (e) {
          res.write(`data: ${JSON.stringify({ ts: Date.now(), error: e.message })}\n\n`);
        }
      };
      await tick();
      const timer = setInterval(tick, 6000);
      req.on('close', () => clearInterval(timer));
      return;
    }

    /* --- 静态资源 --- */
    return serveStatic(req, res, p);
  } catch (err) {
    console.error('[server]', err);
    if (!res.headersSent) sendJson(res, { ok: false, error: err.message }, 500);
  }
});

server.listen(PORT, HOST, () => {
  const w = readWatchlist();
  const shown = HOST === '0.0.0.0' ? '127.0.0.1' : HOST;
  console.log(`\n  StockSentry 智能盯盘系统已启动`);
  console.log(`  ▸ 监听 ${HOST}:${PORT}　本地访问 http://${shown}:${PORT}`);
  console.log(`  ▸ 自选股：${w.codes.join(', ')}\n`);
});
