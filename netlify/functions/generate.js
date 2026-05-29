const { handleProxyRequest, jsonResponse } = require("../../server/imageProxy.cjs");

exports.handler = async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return jsonResponse(204, {});
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "只支持 POST 请求" });
  }

  return handleProxyRequest(event.body);
};
