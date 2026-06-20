# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

一个图片编辑代理网页：纯静态前端（`public/`）调用同源 `/api/generate`，由服务端函数把请求转发到兼容 OpenAI 图片编辑格式的上游接口，解析返回里的 `b64_json` 图片。代理层的存在是为了规避浏览器跨域，并对外隐藏 API Key 转发逻辑。无前端框架、无构建步骤、无依赖（仅用 Node 内置模块）。

## 常用命令

```bash
npm run dev      # 启动本地服务 http://localhost:3000（等价于 npm start）
```

没有测试、lint 或构建命令。修改后直接刷新浏览器验证。

## 架构

核心设计是 **一份代理逻辑、三个运行时入口**。共享逻辑全部在 `server/imageProxy.cjs`，三个入口仅做请求/响应格式适配：

- `server/imageProxy.cjs` — 唯一的业务逻辑（CommonJS）。导出 `handleProxyRequest(rawBody)` 和 `jsonResponse()`。负责：URL 规范化、域名白名单校验、鉴权头构造、请求体校验、超时控制、调用上游 `fetch`、解析响应。
- `api/generate.js` — Vercel Serverless 入口（`req`/`res` 风格）。
- `netlify/functions/generate.js` — Netlify Functions 入口（`event` 风格）。
- `server/local-dev.cjs` — 本地 Node HTTP 服务，既托管 `public/` 静态文件，又把 `/api/generate` 路由到同一份代理逻辑。

**改动代理行为时，几乎总是只改 `imageProxy.cjs`**；三个入口很薄，一般无需同步修改。

### 请求数据流

前端 `readFormPayload()`（`public/app.js`）组装出一个 envelope，结构为：
```
{ apiBaseUrl, endpointPath, apiKey, authMode, customHeaderName, timeoutSeconds, request }
```
其中 `request` 才是真正发给上游的 OpenAI 格式 body（`images[].image_url`、`prompt`、`model`、`n`、`size`、`quality`、`background`、`output_format`，以及前端"额外 JSON"里 `Object.assign` 进来的字段）。代理把 envelope 拆开：用外层字段决定转发地址与鉴权，把内层 `request` 原样 POST 给上游。

`normalizeTargetUrl` 会智能拼接 `apiBaseUrl` + `endpointPath`（若 base 已以该 endpoint 结尾则不重复拼接）。`buildAuthHeaders` 支持四种 `authMode`：`bearer` / `x-api-key` / `custom`（自定义 header 名）/ `none`。

### 关键环境变量

- `ALLOWED_IMAGE_API_HOSTS` — 逗号分隔的上游 host 白名单；为空表示不限制（公开部署时强烈建议设置）。
- `IMAGE_API_TIMEOUT_MS`（默认 110000）/ `IMAGE_API_MAX_TIMEOUT_MS`（默认 900000）— 代理超时默认值与上限。前端传入的 `timeoutSeconds` 会被 clamp 到 `[5s, 上限]`。

## 部署约束

- Vercel：`vercel.json` 将 `api/generate.js` 配置为最多运行 300 秒，适合长耗时图片生成。
- Netlify：`netlify.toml` 设发布目录 `public`、函数目录 `netlify/functions`，并把 `/api/generate` 重写到 `/.netlify/functions/generate`。同步函数有平台执行时间上限，长任务更建议用 Vercel 或自托管。

## 约定

- 用户面向的字符串与错误信息使用中文。
- 服务端模块用 `.cjs`（CommonJS）；前端 `public/app.js` 是无模块化的浏览器脚本，靠全局 DOM 选择器驱动。
