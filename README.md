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
