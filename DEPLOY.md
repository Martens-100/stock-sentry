# StockSentry 部署指南（Cloudflare Pages）

> 一句话结论：StockSentry 的静态版（`docs/`）已在浏览器端完成全部逻辑，**用 Cloudflare Pages 纯静态托管即可**，
> 不需要 Workers 运行时、不需要 D1 数据库、**不需要任何环境变量**。

---

## 1. 选型说明：为什么是 Cloudflare Pages

| 维度 | 说明 |
|---|---|
| 服务类型 | **Cloudflare Pages（静态托管）**，部署目录 `docs/` |
| 是否需要 Workers | 否。行情、名称搜索（`smartbox` JSONP）、分析全在浏览器端完成 |
| 是否需要 D1 | 否。无服务端数据库 |
| 是否需要环境变量 | **否**。所有配置已编译进静态产物 |
| 是否需要构建命令 | **否**。`docs/` 是预构建产物，已在仓库里（`build-static.js` 生成） |

回退根因：原「输股票名查不到」是因为本地 Node 服务（`server.js`）没做常驻守护、进程随会话退出；
改成纯静态托管后**没有进程可死**，从根上规避了「服务挂了」。

---

## 2. 前置条件（当前已满足）

- ✅ 代码已提交并推送到 `main`：`docs/` 含 `index.html` `bundle.js` `static-api.js` `app.js` `style.css` 及 `docs/_headers`
- ✅ `docs/_headers` 已就位：对 `/*` 加安全头、对 `/*.html` 设 `no-cache`（防「用户卡在旧版本」）
- ✅ 资源带内容指纹（`?v=sha256`），内容一变更 URL 即变，可放心长期缓存

> 若你改了源码需要重新构建：`node build-static.js`（零依赖，无需 `npm install`）。

---

## 3. 方式一：Cloudflare Dashboard 连 GitHub（推荐，零 CLI）

1. 打开 **[Cloudflare Dashboard](https://dash.cloudflare.com)** → 左侧 **Workers & Pages** →
   **Create** / **Create application** → 切到 **Pages** 标签 → **Connect to Git**。
2. 首次会跳 GitHub OAuth 授权，授权后选择仓库 **`Martens-100/stock-sentry`**。
3. 项目设置（关键，别让向导自动推断）：
   - **Project name**：`stocksentry`（任意，但与 `wrangler.toml` 保持一致最省心）
   - **Framework preset**：`None`
   - **Build command**：**留空**
   - **Build output directory**：**`docs`**
4. 点 **Save and Deploy**。约 30–60 秒后得到 `https://<project>.pages.dev`（如 `https://stocksentry.pages.dev`）。
5. （可选）**Custom domains** 绑定自己的域名：Cloudflare 自动签发证书、自动管理 DNS，无需手动加记录。

> 因为 `docs/_headers` 已随提交进入仓库，安全头与不缓存规则会**自动生效**，无需额外配置。

---

## 4. 方式二：wrangler CLI（备用 / 自动化）

```bash
# 首次需交互登录一次（会打开浏览器授权）
npx wrangler login

# 部署（读取本地 docs/ 直接上传，不走 git）
npx wrangler pages deploy docs/ --project-name stocksentry
```

> 非交互 / CI 环境：用 `CLOUDFLARE_API_TOKEN`（需 **Pages:Edit** 权限）代替 `wrangler login`：
> ```bash
> CLOUDFLARE_API_TOKEN=xxxx npx wrangler pages deploy docs/ --project-name stocksentry
> ```

配置文件 `wrangler.toml` 已就绪：
```toml
name = "stocksentry"
compatibility_date = "2026-09-17"
pages_build_output_dir = "docs"
```

---

## 5. 上线后验证清单

- [ ] **可访问**：浏览器打开 `*.pages.dev`，首页正常渲染
- [ ] **HTTPS**：地址栏有锁，证书由 Cloudflare 自动签发（无需手动配置）
- [ ] **核心功能**：搜「中兴通讯」→ 应返回 `000063 中兴通讯`；点开标的看行情 / 分析卡片正常出数
- [ ] **无旧缓存**：HTML 带 `no-cache` + 资源指纹，刷新即为最新版
- [ ] **安全头**：`curl -I <url>` 可见 `x-frame-options: DENY` 等（来自 `docs/_headers`）

> 把上线后的地址发项目维护者，可用真机断言脚本核对：
> `node scripts/verify-live-webkit.js <url>` 与 `node scripts/verify-chart-layers.js <url>`。

---

## 6. 免费额度（Cloudflare Pages Free）

| 项 | 额度 |
|---|---|
| 请求数 | 无限 |
| 带宽 | 无限 |
| 构建次数 | 500 次 / 月 |
| 并发构建 | 1 |
| 自定义域名 | 支持，自动 HTTPS |

本项目纯静态、**完全落在免费档内**，不会触发任何付费项。
（仅在额外加 Pages Functions 时才按 Workers 免费档计费：10 万请求/日、10ms CPU、128MB——本项目未使用。）

---

## 7. 排错

- **部署后页面空白 / 旧版本**：清掉浏览器缓存强刷；确认 `docs/index.html` 里声明了 `window.__SENTRY_STATIC__ = true`（走浏览器内 `static-api.js`）。
- **名称搜索无结果**：是浏览器端 JSONP 直连 `smartbox.gtimg.cn`，检查你的网络 / 代理是否放行该域名；诊断面板「复制诊断信息」可定位。
- **`*.pages.dev` 打不开**：等 1–2 分钟（CDN 预热期可能短暂返回空）；确认构建输出目录填的是 `docs` 而非仓库根。
- **Dashboard 找不到仓库**：回到第 2 步确认 GitHub 授权时勾选了对应账号 / 组织。
