# 图片生成控制台

一个可部署到 Vercel 或 Netlify 的图片编辑网页。前端只调用同源 `/api/generate`，服务端函数再转发到兼容 OpenAI 图片编辑格式的接口，用来避免浏览器跨域问题，并解析返回里的 `b64_json` 图片。

## 本地运行

```bash
npm run dev
```

打开 `http://localhost:3000`。

## Vercel 部署

直接导入仓库即可。静态页面位于 `public`，服务端函数位于 `api/generate.js`。

## Netlify 部署

直接导入仓库即可。`netlify.toml` 已配置：

- 发布目录：`public`
- 函数目录：`netlify/functions`
- `/api/generate` 重写到 `/.netlify/functions/generate`

## 域名限制

如果部署成公开站点，建议配置环境变量限制可转发的上游域名：

```bash
ALLOWED_IMAGE_API_HOSTS=stellar-quokka-2fdb2f.netlify.app
```

多个域名使用英文逗号分隔。

## 超时

页面里的“代理超时（秒）”会传给服务端代理，服务端默认等待 110 秒。也可以通过环境变量调整默认值和上限：

```bash
IMAGE_API_TIMEOUT_MS=110000
IMAGE_API_MAX_TIMEOUT_MS=900000
```

Vercel 的 `api/generate.js` 已在 `vercel.json` 中配置为最多运行 300 秒。Netlify 同步函数有平台执行时间限制，长耗时图片生成更建议部署到 Vercel 或自托管 Node 服务。
