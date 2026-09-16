'use strict';
/**
 * 本地预览服务 —— 把构建产物 docs/ 用 http 起出来，用于在真机/浏览器里看布局。
 *
 * 为什么不能直接双击 docs/index.html：
 *   file:// 下 fetch 会被浏览器直接禁掉，页面只能走 JSONP 兜底。
 *   于是「正常网络路径」的问题会被掩盖 —— 测了半天，测的是降级路径。
 *   要看真实表现就必须给一个 http 源。
 *
 * 用法：
 *   node scripts/preview-server.js            # 默认 http://127.0.0.1:8788/
 *   node scripts/preview-server.js 9000       # 指定端口
 *   node scripts/preview-server.js 8788 0.0.0.0   # 监听全部网卡（同局域网手机可访问）
 *
 * 另外会额外暴露 /__standalone ，直接看单文件版（同样以 http 提供）。
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const STANDALONE = path.join(ROOT, 'out', 'stock-sentry-standalone.html');
const PORT = Number(process.argv[2]) || 8788;
const HOST = process.argv[3] || '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

/** 禁止用 ../ 跳出产物目录：预览服务也不该能读到仓库里的其它文件 */
function safeJoin(base, rel) {
  const p = path.normalize(path.join(base, rel));
  return p.startsWith(base) ? p : null;
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);

  if (urlPath === '/__standalone') {
    if (!fs.existsSync(STANDALONE)) { res.writeHead(404); res.end('单文件版未构建，请先运行 node build-static.js'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    fs.createReadStream(STANDALONE).pipe(res);
    return;
  }

  const file = safeJoin(DOCS, urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, ''));
  if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
    // 和线上一致地禁缓存：否则改完源码刷新看到的还是旧产物，
    // 会误判成「改了没生效」。
    'Cache-Control': 'no-store'
  });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, HOST, () => {
  console.log('预览服务已启动：');
  console.log(`  多文件版  http://${HOST === '0.0.0.0' ? '127.0.0.1' : HOST}:${PORT}/`);
  console.log(`  单文件版  http://${HOST === '0.0.0.0' ? '127.0.0.1' : HOST}:${PORT}/__standalone`);
  if (HOST === '0.0.0.0') {
    const nets = require('os').networkInterfaces();
    Object.values(nets).flat().filter((n) => n && n.family === 'IPv4' && !n.internal)
      .forEach((n) => console.log(`  同局域网  http://${n.address}:${PORT}/   ← 手机可直接打开`));
  }
  console.log('\n把窗口收窄到 860px 以下（或直接用手机打开）即为方案 E 的移动布局。Ctrl+C 停止。');
});
