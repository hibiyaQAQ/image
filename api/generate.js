const { handleProxyRequest, jsonResponse } = require("../server/imageProxy.cjs");

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    const optionsResponse = jsonResponse(204, {});
    for (const [key, value] of Object.entries(optionsResponse.headers)) {
      res.setHeader(key, value);
    }
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    const methodResponse = jsonResponse(405, { error: "只支持 POST 请求" });
    for (const [key, value] of Object.entries(methodResponse.headers)) {
      res.setHeader(key, value);
    }
    res.status(405).send(methodResponse.body);
    return;
  }

  const proxyResponse = await handleProxyRequest(req.body);
  for (const [key, value] of Object.entries(proxyResponse.headers)) {
    res.setHeader(key, value);
  }
  res.status(proxyResponse.statusCode).send(proxyResponse.body);
};
