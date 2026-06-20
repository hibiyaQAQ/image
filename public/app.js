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

const STORAGE_KEY = "editimage:form:v1";
const PERSIST_FIELDS = [
  "apiBaseUrl",
  "endpointPath",
  "authMode",
  "customHeaderName",
  "apiKey",
  "model",
  "size",
  "n",
  "timeoutSeconds",
  "quality",
  "background",
  "outputFormat",
  "moderation",
  "prompt",
  "extraJson"
];

function saveForm() {
  try {
    const formData = new FormData(elements.form);
    const state = {};
    for (const name of PERSIST_FIELDS) {
      state[name] = String(formData.get(name) ?? "");
    }
    state.images = collectImageUrls();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    // localStorage 不可用（隐私模式 / 配额已满）时静默跳过，不影响主流程
  }
}

function loadForm() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const state = JSON.parse(raw);
    return state && typeof state === "object" ? state : null;
  } catch (error) {
    return null;
  }
}

function clearSavedForm() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    // 同上，忽略
  }
}

function applyState(state) {
  for (const name of PERSIST_FIELDS) {
    if (state[name] === undefined) {
      continue;
    }
    const field = elements.form.elements[name];
    if (field) {
      field.value = state[name];
    }
  }
}

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
      saveForm();
      return;
    }

    input.value = "";
    thumb.removeAttribute("src");
    saveForm();
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
  const moderation = String(formData.get("moderation") || "");
  if (quality) request.quality = quality;
  if (background) request.background = background;
  if (outputFormat) request.output_format = outputFormat;
  if (moderation) request.moderation = moderation;

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

function appendImages(response, taskIndex) {
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
    img.alt = `任务 ${taskIndex + 1} 生成结果 ${index + 1}`;
    img.src = dataUrl;

    const actions = document.createElement("div");
    actions.className = "result-actions";

    const downloadButton = document.createElement("button");
    downloadButton.type = "button";
    downloadButton.className = "button small";
    downloadButton.textContent = "下载";
    downloadButton.addEventListener("click", () => {
      downloadDataUrl(dataUrl, `image-t${taskIndex + 1}-${index + 1}.${outputFormat}`);
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

function appendErrorCard(message, detail, taskIndex) {
  const article = document.createElement("article");
  article.className = "result-item error";

  const title = document.createElement("div");
  title.className = "result-error-title";
  title.textContent = `任务 ${taskIndex + 1} 失败`;

  const body = document.createElement("p");
  body.className = "result-error-message";
  body.textContent = message || "未知错误";

  article.append(title, body);

  if (detail !== undefined && detail !== null) {
    const details = document.createElement("details");
    details.className = "result-error-detail";
    const summary = document.createElement("summary");
    summary.textContent = "查看详情";
    const pre = document.createElement("pre");
    pre.textContent = typeof detail === "string" ? detail : JSON.stringify(detail, null, 2);
    details.append(summary, pre);
    article.append(details);
  }

  elements.previewGrid.appendChild(article);
}

function aggregateUsage(usages) {
  if (usages.length === 0) {
    return null;
  }
  if (usages.length === 1) {
    return usages[0];
  }

  const sum = (pick) => usages.reduce((acc, usage) => acc + (Number(pick(usage)) || 0), 0);
  return {
    input_tokens: sum((u) => u.input_tokens),
    output_tokens: sum((u) => u.output_tokens),
    total_tokens: sum((u) => u.total_tokens),
    input_tokens_details: {
      image_tokens: sum((u) => u.input_tokens_details?.image_tokens),
      text_tokens: sum((u) => u.input_tokens_details?.text_tokens)
    }
  };
}

function clearOutput() {
  elements.previewGrid.innerHTML = "";
  elements.usageList.innerHTML = "";
  elements.rawResponse.textContent = "";
  elements.usageBox.classList.add("hidden");
  elements.rawResponseBox.classList.add("hidden");
  setStatus("等待生成");
}

async function sendSingleRequest(payload) {
  const controller = new AbortController();
  const clientTimeoutMs = payload.timeoutSeconds * 1000 + CLIENT_TIMEOUT_PADDING_MS;
  const timeoutId = setTimeout(() => controller.abort(), clientTimeoutMs);

  try {
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
      const message = result.error || `请求失败：HTTP ${response.status}`;
      return { ok: false, message, detail: result };
    }

    return { ok: true, data: result };
  } catch (error) {
    let message = error.message || "生成失败";
    if (error.name === "AbortError") {
      message = "浏览器等待超时：代理接口长时间没有返回";
    } else if (error instanceof TypeError && /fetch/i.test(error.message || "")) {
      message = "网络请求失败：代理函数可能超时、崩溃或被部署平台断开，请查看函数日志";
    }
    return { ok: false, message, detail: null };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function generateImage() {
  if (!elements.form.reportValidity()) {
    return;
  }

  let payload;
  try {
    payload = readFormPayload();
  } catch (error) {
    setStatus(error.message || "参数有误", "error");
    return;
  }

  const count = Math.max(Number(payload.request.n) || 1, 1);
  clearOutput();
  elements.generateButton.disabled = true;
  setStatus(count > 1 ? `正在并行生成 ${count} 张图片…` : "正在请求图片接口", "loading");

  const rawResponses = [];
  const usages = [];
  let imageCount = 0;
  let failed = 0;
  let done = 0;

  const updateProgress = () => {
    if (done >= count) {
      return;
    }
    setStatus(`完成 ${done}/${count} · 成功 ${imageCount} 张 / 失败 ${failed} 个`, "loading");
  };

  // 每张图片拆成独立请求（n=1）并行发送，彼此隔离：单次失败不影响其它结果，成功的即时显示。
  const tasks = Array.from({ length: count }, (_, index) => {
    const singlePayload = {
      ...payload,
      request: { ...payload.request, n: 1 }
    };

    return sendSingleRequest(singlePayload).then((outcome) => {
      done += 1;
      if (outcome.ok) {
        rawResponses.push(outcome.data);
        if (outcome.data.usage) {
          usages.push(outcome.data.usage);
        }
        const added = appendImages(outcome.data, index);
        if (added > 0) {
          imageCount += added;
        } else {
          failed += 1;
          appendErrorCard("响应中没有 b64_json 图片", outcome.data, index);
        }
      } else {
        failed += 1;
        rawResponses.push(outcome.detail ?? { error: outcome.message });
        appendErrorCard(outcome.message, outcome.detail, index);
      }
      updateProgress();
    });
  });

  await Promise.allSettled(tasks);

  renderUsage(aggregateUsage(usages));
  elements.rawResponse.textContent = JSON.stringify(count === 1 ? rawResponses[0] : rawResponses, null, 2);
  elements.rawResponseBox.classList.remove("hidden");

  if (imageCount > 0 && failed === 0) {
    setStatus(`已生成 ${imageCount} 张图片`, "success");
  } else if (imageCount > 0 && failed > 0) {
    setStatus(`部分成功：生成 ${imageCount} 张，失败 ${failed} 个`, "partial");
  } else {
    setStatus(`全部失败：${failed} 个任务均未成功，详情见下方卡片`, "error");
  }

  elements.generateButton.disabled = false;
}

function resetForm() {
  clearSavedForm();
  elements.form.reset();
  elements.imageList.innerHTML = "";
  addImageRow(DEFAULT_IMAGE_URL);
  toggleAuthFields();
  clearOutput();
}

elements.addImageButton.addEventListener("click", () => {
  addImageRow("");
  saveForm();
});
elements.generateButton.addEventListener("click", generateImage);
elements.resetButton.addEventListener("click", resetForm);
elements.clearOutputButton.addEventListener("click", clearOutput);
elements.authMode.addEventListener("change", toggleAuthFields);

// 任意字段输入/变更后即时写入 localStorage（参考图 URL 的 input 事件也会冒泡到 form）
elements.form.addEventListener("input", saveForm);
elements.form.addEventListener("change", saveForm);

// 启动时优先恢复上次保存的配置；没有则用默认参考图
const savedState = loadForm();
if (savedState && Array.isArray(savedState.images) && savedState.images.length > 0) {
  savedState.images.forEach((url) => addImageRow(url));
} else {
  addImageRow(DEFAULT_IMAGE_URL);
}
if (savedState) {
  applyState(savedState);
}
toggleAuthFields();
