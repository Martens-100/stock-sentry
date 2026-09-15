'use strict';
/**
 * 静态部署版后端替身：在浏览器内直接完成自选股管理与分析调用，
 * 行情数据由腾讯财经接口通过 CORS 直连获取（无服务端）。
 * 仅在 window.__SENTRY_STATIC__ === true 时被 app.js 使用。
 */
(function () {
  const L = window.SentryLib;
  if (!L) { console.error('[SentryStatic] bundle.js 未加载'); return; }

  const { source, engine, report } = L;
  const LS_KEY = 'stocksentry.watchlist.v2';
  const DEFAULT_CODES = ['000063', '002422', '000032'];
  const REFRESH_SEC = 8;

  /* ---------------- 自选股持久化 ---------------- */
  function readStore() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const o = JSON.parse(raw);
        if (o && Array.isArray(o.codes) && o.codes.length) return o;
      }
    } catch (_) { /* localStorage 不可用时降级为内存态 */ }
    return { codes: DEFAULT_CODES.slice(), refreshSec: REFRESH_SEC };
  }
  function writeStore(w) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(w)); } catch (_) {}
  }
  function norm(code) { return source.normalize(code).code; }

  /* ---------------- 接口实现 ---------------- */
  async function getWatchlist() {
    const w = readStore();
    const quotes = await source.getQuotes(w.codes).catch(() => ({}));
    return {
      codes: w.codes,
      refreshSec: w.refreshSec || REFRESH_SEC,
      list: w.codes.map((c) => {
        const code = norm(c);
        const quote = quotes[code] || null;
        const pf = engine.getProfile(code);
        return { code, name: (quote && quote.name) || (pf && pf.name) || code, hasProfile: !!pf, quote };
      })
    };
  }

  function postWatchlist(payload) {
    const w = readStore();
    if (payload && payload.add) {
      const code = norm(payload.add);
      if (code && !w.codes.includes(code)) w.codes.push(code);
    }
    if (payload && payload.remove) {
      const code = norm(payload.remove);
      w.codes = w.codes.filter((c) => c !== code);
    }
    if (payload && Array.isArray(payload.codes)) w.codes = payload.codes.map(norm).filter(Boolean);
    if (!w.codes.length) w.codes = DEFAULT_CODES.slice();
    writeStore(w);
    return { ok: true, codes: w.codes, refreshSec: w.refreshSec || REFRESH_SEC };
  }

  async function makeReport(code) {
    const data = await engine.analyze(code);
    const md = report.buildReport(data);
    return { ok: true, code: data.code, name: data.name, md, bodyHtml: report.mdToHtml(md), files: [] };
  }

  /* ---------------- 路由 ---------------- */
  async function handle(path, opts) {
    const u = new URL(path, location.origin);
    const p = u.pathname;
    const q = u.searchParams;
    const method = (opts && opts.method) || 'GET';
    let body = null;
    if (opts && opts.body) { try { body = JSON.parse(opts.body); } catch (_) {} }

    switch (p) {
      case '/api/watchlist':
        return method === 'POST' ? postWatchlist(body) : getWatchlist();

      case '/api/search':
        return { ok: true, rows: await source.searchStocks(q.get('q') || '') };

      case '/api/analyze': {
        const code = q.get('code');
        if (!code) return { ok: false, error: '缺少 code 参数' };
        return { ok: true, data: await engine.analyze(code) };
      }

      case '/api/scan': {
        const codes = (q.get('codes') || readStore().codes.join(',')).split(',').filter(Boolean);
        const data = await Promise.all(codes.map(async (c) => {
          try { return await engine.analyze(c); } catch (e) { return { code: c, error: e.message }; }
        }));
        return { ok: true, data, ts: Date.now() };
      }

      case '/api/report':
        return makeReport(q.get('code'));

      default:
        return { ok: false, error: '静态版不支持的接口：' + p };
    }
  }

  window.SentryStatic = { handle, version: 'static-1.0' };
})();
