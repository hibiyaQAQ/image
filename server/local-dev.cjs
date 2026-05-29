const http = require("http");
const fs = require("fs");
const path = require("path");
const { handleProxyRequest, jsonResponse } = require("./imageProxy.cjs");

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, "..", "public");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml"
};

function send(res, statusCode, headers, body) {
  res.writeHead(statusCode, headers);
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const safePath = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath === "/" ? "index.html" : safePath);
  const resolvedPath = path.resolve(filePath);

  if (!resolvedPath.startsWith(path.resolve(PUBLIC_DIR))) {
    const response = jsonResponse(403, { error: "访问被拒绝" });
    send(res, response.statusCode, response.headers, response.body);
    return;
  }

  fs.readFile(resolvedPath, (error, content) => {
    if (error) {
      const fallback = path.join(PUBLIC_DIR, "index.html");
      fs.readFile(fallback, (fallbackError, fallbackContent) => {
        if (fallbackError) {
          const response = jsonResponse(404, { error: "文件不存在" });
          send(res, response.statusCode, response.headers, response.body);
          return;
        }
        send(res, 200, { "Content-Type": mimeTypes[".html"] }, fallbackContent);
      });
      return;
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    send(res, 200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" }, content);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.url.startsWith("/api/generate")) {
    if (req.method === "OPTIONS") {
      const response = jsonResponse(204, {});
      send(res, response.statusCode, response.headers, "");
      return;
    }

    if (req.method !== "POST") {
      const response = jsonResponse(405, { error: "只支持 POST 请求" });
      send(res, response.statusCode, response.headers, response.body);
      return;
    }

    const body = await readBody(req);
    const response = await handleProxyRequest(body);
    send(res, response.statusCode, response.headers, response.body);
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`本地服务已启动：http://localhost:${PORT}`);
});
