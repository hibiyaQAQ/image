const DEFAULT_IMAGE_URL =
  "https://patchwiki.biligame.com/images/arknights/1/11/p6dnxwdyfhj5p2izztffkfj3nmcjt07.png";
const CLIENT_TIMEOUT_PADDING_MS = 5000;

const elements = {
  form: document.querySelector("#requestForm"),
  generateButton: document.querySelector("#generateButton"),
  resetButton: document.querySelector("#resetButton"),
  clearOutputButton: document.querySelector("#clearOutputButton"),
  addImageButton: document.querySelector("#addImageButton"),
  imageList: document.querySelector("#imageList"),
  imageTemplate: document.querySelector("#imageInputTemplate"),
  authMode: document.querySelector("#authMode"),
  apiKeyField: document.querySelector("#apiKeyField"),
  customHeaderField: document.querySelector("#customHeaderField"),
  statusBox: document.querySelector("#statusBox"),
  previewGrid: document.querySelector("#previewGrid"),
  usageBox: document.querySelector("#usageBox"),
  usageList: document.querySelector("#usageList"),
  rawResponseBox: document.querySelector("#rawResponseBox"),
  rawResponse: document.querySelector("#rawResponse")
};

function setStatus(message, type = "empty") {
  elements.statusBox.textContent = message;
  elements.statusBox.className = `status ${type}`;
}

function toggleAuthFields() {
  const mode = elements.authMode.value;
  elements.apiKeyField.classList.toggle("hidden", mode === "none");
  elements.customHeaderField.classList.toggle("hidden", mode !== "custom");
}

function addImageRow(value = "") {
  const fragment = elements.imageTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".image-row");
  const input = fragment.querySelector(".image-url-input");
  const thumb = fragment.querySelector(".thumb");
  const removeButton = fragment.querySelector(".remove-image-button");

  input.value = value;
  thumb.src = value;

  input.addEventListener("input", () => {
    thumb.src = input.value.trim();
  });

  thumb.addEventListener("error", () => {
    thumb.removeAttribute("src");
  });

  removeButton.addEventListener("click", () => {
    if (elements.imageList.children.length > 1) {
      row.remove();
      return;
    }

    input.value = "";
    thumb.removeAttribute("src");
  });

  elements.imageList.appendChild(fragment);
}

function collectImageUrls() {
  return [...document.querySelectorAll(".image-url-input")]
    .map((input) => input.value.trim())
    .filter(Boolean);
}

function parseExtraJson() {
  const raw = document.querySelector("#extraJson").value.trim();
  if (!raw) {
    return {};
  }

  const parsed = JSON.parse(raw);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("额外 JSON 必须是对象");
  }
  return parsed;
}

function normalizeTimeoutSeconds(value) {
  const parsed = Number(value || 110);
  if (!Number.isFinite(parsed)) {
    throw new Error("代理超时必须是数字");
  }
  return Math.min(Math.max(Math.round(parsed), 5), 900);
}

function readFormPayload() {
  const formData = new FormData(elements.form);
  const imageUrls = collectImageUrls();
  if (imageUrls.length === 0) {
    throw new Error("至少需要一张参考图 URL");
  }

  const request = {
    images: imageUrls.map((imageUrl) => ({ image_url: imageUrl })),
    prompt: String(formData.get("prompt") || "").trim(),
    n: Number(formData.get("n") || 1),
    size: String(formData.get("size") || "1024x1024"),
    model: String(formData.get("model") || "").trim()
  };

  const quality = String(formData.get("quality") || "");
  const background = String(formData.get("background") || "");
  const outputFormat = String(formData.get("outputFormat") || "");
  if (quality) request.quality = quality;
  if (background) request.background = background;
  if (outputFormat) request.output_format = outputFormat;

  Object.assign(request, parseExtraJson());

  return {
    apiBaseUrl: String(formData.get("apiBaseUrl") || "").trim(),
    endpointPath: String(formData.get("endpointPath") || "").trim(),
    apiKey: String(formData.get("apiKey") || ""),
    authMode: String(formData.get("authMode") || "bearer"),
    customHeaderName: String(formData.get("customHeaderName") || "").trim(),
    timeoutSeconds: normalizeTimeoutSeconds(formData.get("timeoutSeconds")),
    request
  };
}

async function copyText(text) {
  await navigator.clipboard.writeText(text);
}

function downloadDataUrl(dataUrl, fileName) {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function renderUsage(usage) {
  elements.usageList.innerHTML = "";
  if (!usage || typeof usage !== "object") {
    elements.usageBox.classList.add("hidden");
    return;
  }

  const rows = [
    ["输入 tokens", usage.input_tokens],
    ["图片输入 tokens", usage.input_tokens_details?.image_tokens],
    ["文本输入 tokens", usage.input_tokens_details?.text_tokens],
    ["输出 tokens", usage.output_tokens],
    ["总 tokens", usage.total_tokens]
  ].filter(([, value]) => value !== undefined && value !== null);

  for (const [label, value] of rows) {
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = String(value);
    elements.usageList.append(dt, dd);
  }

  elements.usageBox.classList.toggle("hidden", rows.length === 0);
}

function renderImages(response) {
  elements.previewGrid.innerHTML = "";
  const outputFormat = response.output_format || "png";
  const items = Array.isArray(response.data) ? response.data : [];
  const images = items
    .map((item) => item?.b64_json)
    .filter((value) => typeof value === "string" && value.length > 0);

  images.forEach((base64, index) => {
    const dataUrl = `data:image/${outputFormat};base64,${base64}`;
    const article = document.createElement("article");
    article.className = "result-item";

    const img = document.createElement("img");
    img.alt = `生成结果 ${index + 1}`;
    img.src = dataUrl;

    const actions = document.createElement("div");
    actions.className = "result-actions";

    const downloadButton = document.createElement("button");
    downloadButton.type = "button";
    downloadButton.className = "button small";
    downloadButton.textContent = "下载";
    downloadButton.addEventListener("click", () => {
      downloadDataUrl(dataUrl, `image-${Date.now()}-${index + 1}.${outputFormat}`);
    });

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "button small";
    copyButton.textContent = "复制 Data URL";
    copyButton.addEventListener("click", async () => {
      await copyText(dataUrl);
      copyButton.textContent = "已复制";
      setTimeout(() => {
        copyButton.textContent = "复制 Data URL";
      }, 1200);
    });

    actions.append(downloadButton, copyButton);
    article.append(img, actions);
    elements.previewGrid.appendChild(article);
  });

  return images.length;
}

function renderResponse(response) {
  const count = renderImages(response);
  renderUsage(response.usage);
  elements.rawResponse.textContent = JSON.stringify(response, null, 2);
  elements.rawResponseBox.classList.remove("hidden");
  setStatus(count > 0 ? `已生成 ${count} 张图片` : "响应中没有 b64_json 图片", count > 0 ? "success" : "error");
}

function clearOutput() {
  elements.previewGrid.innerHTML = "";
  elements.usageList.innerHTML = "";
  elements.rawResponse.textContent = "";
  elements.usageBox.classList.add("hidden");
  elements.rawResponseBox.classList.add("hidden");
  setStatus("等待生成");
}

async function generateImage() {
  let timeoutId;
  try {
    if (!elements.form.reportValidity()) {
      return;
    }

    const payload = readFormPayload();
    const controller = new AbortController();
    const clientTimeoutMs = payload.timeoutSeconds * 1000 + CLIENT_TIMEOUT_PADDING_MS;
    timeoutId = setTimeout(() => controller.abort(), clientTimeoutMs);

    elements.generateButton.disabled = true;
    setStatus("正在请求图片接口", "loading");

    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error || `请求失败：HTTP ${response.status}`);
    }

    renderResponse(result);
  } catch (error) {
    let message = error.message || "生成失败";
    if (error.name === "AbortError") {
      message = "浏览器等待超时：代理接口长时间没有返回";
    } else if (error instanceof TypeError && /fetch/i.test(error.message || "")) {
      message = "网络请求失败：代理函数可能超时、崩溃或被部署平台断开，请查看函数日志";
    }
    setStatus(message, "error");
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    elements.generateButton.disabled = false;
  }
}

function resetForm() {
  elements.form.reset();
  elements.imageList.innerHTML = "";
  addImageRow(DEFAULT_IMAGE_URL);
  toggleAuthFields();
  clearOutput();
}

elements.addImageButton.addEventListener("click", () => addImageRow(""));
elements.generateButton.addEventListener("click", generateImage);
elements.resetButton.addEventListener("click", resetForm);
elements.clearOutputButton.addEventListener("click", clearOutput);
elements.authMode.addEventListener("change", toggleAuthFields);

addImageRow(DEFAULT_IMAGE_URL);
toggleAuthFields();
