const STORAGE_PREFIX = "noteforgex::vault::";
const SESSION_PROVIDER_KEY = "noteforgex::providerSettings";
const APP_VERSION = "static-1.1.0-light";
const requestCache = new Map();

const state = {
  passcode: "",
  projectId: null,
  providerSettings: loadSessionProvider(),
  isGenerating: false,
};

const els = {
  loginView: document.getElementById("loginView"),
  workspaceView: document.getElementById("workspaceView"),
  loginForm: document.getElementById("loginForm"),
  passcodeInput: document.getElementById("passcodeInput"),
  togglePasscodeBtn: document.getElementById("togglePasscodeBtn"),
  generatePasscodeBtn: document.getElementById("generatePasscodeBtn"),
  workspaceMeta: document.getElementById("workspaceMeta"),
  historyList: document.getElementById("historyList"),
  historyCount: document.getElementById("historyCount"),
  projectForm: document.getElementById("projectForm"),
  newProjectBtn: document.getElementById("newProjectBtn"),
  saveProjectBtn: document.getElementById("saveProjectBtn"),
  duplicateProjectBtn: document.getElementById("duplicateProjectBtn"),
  deleteProjectBtn: document.getElementById("deleteProjectBtn"),
  openApiPanelBtn: document.getElementById("openApiPanelBtn"),
  apiDialog: document.getElementById("apiDialog"),
  providerSelect: document.getElementById("providerSelect"),
  geminiFields: document.getElementById("geminiFields"),
  openaiFields: document.getElementById("openaiFields"),
  geminiApiKey: document.getElementById("geminiApiKey"),
  geminiModel: document.getElementById("geminiModel"),
  compatEndpoint: document.getElementById("compatEndpoint"),
  compatApiKey: document.getElementById("compatApiKey"),
  compatModel: document.getElementById("compatModel"),
  saveApiSettingsBtn: document.getElementById("saveApiSettingsBtn"),
  clearApiSettingsBtn: document.getElementById("clearApiSettingsBtn"),
  runResearchBtn: document.getElementById("runResearchBtn"),
  buildOutlineBtn: document.getElementById("buildOutlineBtn"),
  generateHooksBtn: document.getElementById("generateHooksBtn"),
  generateArticleBtn: document.getElementById("generateArticleBtn"),
  performanceMode: document.getElementById("performanceMode"),
  autoRetry: document.getElementById("autoRetry"),
  webGrounding: document.getElementById("webGrounding"),
  researchOutput: document.getElementById("researchOutput"),
  outlineOutput: document.getElementById("outlineOutput"),
  hooksOutput: document.getElementById("hooksOutput"),
  articleOutput: document.getElementById("articleOutput"),
  progressBox: document.getElementById("progressBox"),
  progressLabel: document.getElementById("progressLabel"),
  progressFill: document.getElementById("progressFill"),
  providerStatus: document.getElementById("providerStatus"),
  copyOutputBtn: document.getElementById("copyOutputBtn"),
  exportMarkdownBtn: document.getElementById("exportMarkdownBtn"),
  exportHtmlBtn: document.getElementById("exportHtmlBtn"),
  exportDataBtn: document.getElementById("exportDataBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  toast: document.getElementById("toast"),
  tabs: Array.from(document.querySelectorAll(".tab-btn")),
  panels: Array.from(document.querySelectorAll(".tab-panel")),
};

const formFields = {
  projectTitle: document.getElementById("projectTitle"),
  genre: document.getElementById("genre"),
  theme: document.getElementById("theme"),
  targetReader: document.getElementById("targetReader"),
  goal: document.getElementById("goal"),
  targetLength: document.getElementById("targetLength"),
  tone: document.getElementById("tone"),
  framework: document.getElementById("framework"),
  uniqueness: document.getElementById("uniqueness"),
  researchSeed: document.getElementById("researchSeed"),
};

initialize();

function initialize() {
  bindEvents();
  hydrateProviderPanel();
  updateProviderStatus();
}

function bindEvents() {
  els.loginForm.addEventListener("submit", handleLogin);
  els.togglePasscodeBtn.addEventListener("click", () => {
    els.passcodeInput.type = els.passcodeInput.type === "password" ? "text" : "password";
    els.togglePasscodeBtn.textContent = els.passcodeInput.type === "password" ? "表示" : "非表示";
  });
  els.generatePasscodeBtn.addEventListener("click", () => {
    els.passcodeInput.value = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join("");
  });

  els.newProjectBtn.addEventListener("click", () => {
    state.projectId = null;
    clearProjectForm();
    showToast("新規案件モードに切り替えました");
  });
  els.saveProjectBtn.addEventListener("click", saveProjectFromForm);
  els.duplicateProjectBtn.addEventListener("click", duplicateCurrentProject);
  els.deleteProjectBtn.addEventListener("click", deleteCurrentProject);
  els.openApiPanelBtn.addEventListener("click", () => els.apiDialog.showModal());
  els.providerSelect.addEventListener("change", toggleProviderFields);
  els.saveApiSettingsBtn.addEventListener("click", saveProviderSettings);
  els.clearApiSettingsBtn.addEventListener("click", clearProviderSettings);
  els.runResearchBtn.addEventListener("click", runResearch);
  els.buildOutlineBtn.addEventListener("click", buildOutline);
  els.generateHooksBtn.addEventListener("click", generateHooks);
  els.generateArticleBtn.addEventListener("click", generateArticle);
  els.copyOutputBtn.addEventListener("click", copyActiveOutput);
  els.exportMarkdownBtn.addEventListener("click", () => exportText("md"));
  els.exportHtmlBtn.addEventListener("click", () => exportText("html"));
  els.exportDataBtn.addEventListener("click", exportVaultJson);
  els.logoutBtn.addEventListener("click", logout);

  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => activateTab(tab.dataset.tab));
  });
}

function handleLogin(event) {
  event.preventDefault();
  const passcode = els.passcodeInput.value.trim();
  if (!/^\d{8}$/.test(passcode)) {
    showToast("8桁の数字で入力してください", true);
    return;
  }

  state.passcode = passcode;
  ensureVault();
  els.workspaceMeta.textContent = `識別コード ${passcode} / ローカル保存 / バージョン ${APP_VERSION}`;
  els.loginView.classList.add("hidden");
  els.workspaceView.classList.remove("hidden");
  renderHistory();
  const vault = getVault();
  if (vault.projects.length) {
    loadProject(vault.projects[0].id);
  } else {
    clearProjectForm();
  }
}

function logout() {
  state.passcode = "";
  state.projectId = null;
  clearProjectForm();
  els.workspaceView.classList.add("hidden");
  els.loginView.classList.remove("hidden");
  els.passcodeInput.value = "";
}

function ensureVault() {
  const key = vaultKey();
  const raw = localStorage.getItem(key);
  if (raw) return;
  const payload = {
    version: APP_VERSION,
    updatedAt: new Date().toISOString(),
    projects: [],
  };
  localStorage.setItem(key, JSON.stringify(payload));
}

function getVault() {
  const raw = localStorage.getItem(vaultKey());
  return raw ? JSON.parse(raw) : { version: APP_VERSION, updatedAt: new Date().toISOString(), projects: [] };
}

function saveVault(vault) {
  vault.updatedAt = new Date().toISOString();
  localStorage.setItem(vaultKey(), JSON.stringify(vault));
}

function vaultKey() {
  return `${STORAGE_PREFIX}${state.passcode}`;
}

function saveProjectFromForm() {
  const project = collectProjectFromForm();
  if (!project.title || !project.theme) {
    showToast("案件名と主題は必須です", true);
    return;
  }

  const vault = getVault();
  if (state.projectId) {
    const index = vault.projects.findIndex((item) => item.id === state.projectId);
    if (index >= 0) {
      vault.projects[index] = {
        ...vault.projects[index],
        ...project,
        updatedAt: new Date().toISOString(),
      };
    }
  } else {
    const id = crypto.randomUUID();
    state.projectId = id;
    vault.projects.unshift({
      ...project,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      outputs: defaultOutputs(),
    });
  }
  saveVault(vault);
  renderHistory();
  showToast("履歴に保存しました");
}

function duplicateCurrentProject() {
  if (!state.projectId) {
    showToast("先に案件を保存してください", true);
    return;
  }
  const vault = getVault();
  const current = vault.projects.find((item) => item.id === state.projectId);
  if (!current) return;
  const clone = JSON.parse(JSON.stringify(current));
  clone.id = crypto.randomUUID();
  clone.title = `${clone.title} - 複製`;
  clone.createdAt = new Date().toISOString();
  clone.updatedAt = clone.createdAt;
  vault.projects.unshift(clone);
  saveVault(vault);
  renderHistory();
  loadProject(clone.id);
  showToast("案件を複製しました");
}

function deleteCurrentProject() {
  if (!state.projectId) {
    showToast("削除する案件がありません", true);
    return;
  }
  const confirmed = window.confirm("現在の案件を削除します。よろしいですか？");
  if (!confirmed) return;
  const vault = getVault();
  vault.projects = vault.projects.filter((item) => item.id !== state.projectId);
  saveVault(vault);
  state.projectId = null;
  clearProjectForm();
  renderHistory();
  showToast("案件を削除しました");
}

function renderHistory() {
  const vault = getVault();
  els.historyCount.textContent = `${vault.projects.length}件`;
  els.historyList.innerHTML = "";

  if (!vault.projects.length) {
    els.historyList.innerHTML = `<div class="history-card"><div class="muted">まだ保存された案件はありません。</div></div>`;
    return;
  }

  vault.projects.forEach((project) => {
    const card = document.createElement("article");
    card.className = "history-card";
    card.innerHTML = `
      <h3>${escapeHtml(project.title)}</h3>
      <div class="history-meta">
        <span>${escapeHtml(project.genre)}</span>
        <span>${Number(project.targetLength || 0).toLocaleString()}文字</span>
        <span>${formatDate(project.updatedAt)}</span>
      </div>
      <div class="history-actions">
        <button class="ghost-btn" data-action="load" data-id="${project.id}">呼び出す</button>
        <button class="ghost-btn" data-action="duplicate" data-id="${project.id}">複製</button>
      </div>
    `;
    card.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.dataset.id;
        if (button.dataset.action === "load") loadProject(id);
        if (button.dataset.action === "duplicate") {
          state.projectId = id;
          duplicateCurrentProject();
        }
      });
    });
    els.historyList.appendChild(card);
  });
}

function loadProject(id) {
  const project = getVault().projects.find((item) => item.id === id);
  if (!project) return;
  state.projectId = id;
  formFields.projectTitle.value = project.title || "";
  formFields.genre.value = project.genre || "副業・マネタイズ";
  formFields.theme.value = project.theme || "";
  formFields.targetReader.value = project.targetReader || "";
  formFields.goal.value = project.goal || "";
  formFields.targetLength.value = String(project.targetLength || 10000);
  formFields.tone.value = project.tone || "AI感を徹底排除した自然文";
  formFields.framework.value = project.framework || "PASONA + ストーリー";
  formFields.uniqueness.value = project.uniqueness || "";
  formFields.researchSeed.value = project.researchSeed || "";
  els.performanceMode.checked = project.performanceMode !== false;
  els.autoRetry.checked = project.autoRetry !== false;
  els.webGrounding.checked = Boolean(project.webGrounding);

  document.querySelectorAll(".psychTrigger").forEach((checkbox) => {
    checkbox.checked = (project.psychTriggers || []).includes(checkbox.value);
  });

  els.researchOutput.value = project.outputs?.research || "";
  els.outlineOutput.value = project.outputs?.outline || "";
  els.hooksOutput.value = project.outputs?.hooks || "";
  els.articleOutput.value = project.outputs?.article || "";
  showToast("案件を呼び出しました");
}

function clearProjectForm() {
  els.projectForm.reset();
  formFields.genre.value = "副業・マネタイズ";
  formFields.targetLength.value = "10000";
  formFields.tone.value = "AI感を徹底排除した自然文";
  formFields.framework.value = "PASONA + ストーリー";
  els.performanceMode.checked = true;
  els.autoRetry.checked = true;
  els.webGrounding.checked = false;
  document.querySelectorAll(".psychTrigger").forEach((checkbox) => {
    checkbox.checked = ["緊急性", "損失回避", "共感", "再現性", "購入不安の除去"].includes(checkbox.value);
  });
  els.researchOutput.value = "";
  els.outlineOutput.value = "";
  els.hooksOutput.value = "";
  els.articleOutput.value = "";
}

function collectProjectFromForm() {
  return {
    title: formFields.projectTitle.value.trim(),
    genre: formFields.genre.value,
    theme: formFields.theme.value.trim(),
    targetReader: formFields.targetReader.value.trim(),
    goal: formFields.goal.value.trim(),
    targetLength: Number(formFields.targetLength.value),
    tone: formFields.tone.value,
    framework: formFields.framework.value,
    uniqueness: formFields.uniqueness.value.trim(),
    researchSeed: formFields.researchSeed.value.trim(),
    performanceMode: els.performanceMode.checked,
    autoRetry: els.autoRetry.checked,
    webGrounding: els.webGrounding.checked,
    psychTriggers: Array.from(document.querySelectorAll(".psychTrigger:checked")).map((item) => item.value),
  };
}

function defaultOutputs() {
  return { research: "", outline: "", hooks: "", article: "" };
}

function hydrateProviderPanel() {
  const settings = state.providerSettings;
  els.providerSelect.value = settings.provider || "gemini";
  els.geminiApiKey.value = settings.geminiApiKey || "";
  els.geminiModel.value = settings.geminiModel || "gemini-2.5-flash";
  els.compatEndpoint.value = settings.compatEndpoint || "";
  els.compatApiKey.value = settings.compatApiKey || "";
  els.compatModel.value = settings.compatModel || "gpt-4.1-mini";
  toggleProviderFields();
}

function toggleProviderFields() {
  const isGemini = els.providerSelect.value === "gemini";
  els.geminiFields.classList.toggle("hidden", !isGemini);
  els.openaiFields.classList.toggle("hidden", isGemini);
}

function saveProviderSettings() {
  state.providerSettings = {
    provider: els.providerSelect.value,
    geminiApiKey: els.geminiApiKey.value.trim(),
    geminiModel: els.geminiModel.value.trim() || "gemini-2.5-flash",
    compatEndpoint: els.compatEndpoint.value.trim(),
    compatApiKey: els.compatApiKey.value.trim(),
    compatModel: els.compatModel.value.trim() || "gpt-4.1-mini",
  };
  sessionStorage.setItem(SESSION_PROVIDER_KEY, JSON.stringify(state.providerSettings));
  updateProviderStatus();
  els.apiDialog.close();
  showToast("このタブにだけAPI設定を保持しました");
}

function clearProviderSettings() {
  sessionStorage.removeItem(SESSION_PROVIDER_KEY);
  state.providerSettings = loadSessionProvider();
  hydrateProviderPanel();
  updateProviderStatus();
  showToast("API設定をクリアしました");
}

function loadSessionProvider() {
  const raw = sessionStorage.getItem(SESSION_PROVIDER_KEY);
  if (!raw) {
    return {
      provider: "gemini",
      geminiApiKey: "",
      geminiModel: "gemini-2.5-flash",
      compatEndpoint: "",
      compatApiKey: "",
      compatModel: "gpt-4.1-mini",
    };
  }
  try {
    return JSON.parse(raw);
  } catch {
    return {
      provider: "gemini",
      geminiApiKey: "",
      geminiModel: "gemini-2.5-flash",
      compatEndpoint: "",
      compatApiKey: "",
      compatModel: "gpt-4.1-mini",
    };
  }
}

function updateProviderStatus() {
  const settings = state.providerSettings;
  const ready = settings.provider === "gemini"
    ? Boolean(settings.geminiApiKey)
    : Boolean(settings.compatEndpoint && settings.compatApiKey);

  if (!ready) {
    els.providerStatus.textContent = "未接続";
    els.providerStatus.style.color = "var(--muted)";
    return;
  }

  els.providerStatus.textContent = settings.provider === "gemini" ? "Gemini接続準備OK" : "互換API接続準備OK";
  els.providerStatus.style.color = "var(--success)";
}

async function runResearch() {
  const project = prepareProjectOrWarn();
  if (!project) return;
  const prompt = buildResearchPrompt(project);
  const result = await guardedGeneration({
    stage: "売れ筋リサーチ中",
    progress: 22,
    prompt,
    grounding: Boolean(project.webGrounding),
    mode: "research",
    project,
    retryLabel: project.webGrounding ? "混雑時は軽量リサーチへ自動切替" : "軽量リサーチを実行中",
  });
  if (!result) return;
  els.researchOutput.value = result;
  saveOutputs({ research: result });
  activateTab("research");
}

async function buildOutline() {
  const project = prepareProjectOrWarn();
  if (!project) return;
  const prompt = buildOutlinePrompt(project, els.researchOutput.value);
  const result = await guardedGeneration({
    stage: "構成生成中",
    progress: 48,
    prompt,
    grounding: false,
    mode: "outline",
    project,
  });
  if (!result) return;
  els.outlineOutput.value = result;
  saveOutputs({ outline: result });
  activateTab("outline");
}

async function generateHooks() {
  const project = prepareProjectOrWarn();
  if (!project) return;
  const prompt = buildHooksPrompt(project, els.researchOutput.value, els.outlineOutput.value);
  const result = await guardedGeneration({
    stage: "タイトル・導入・CTA生成中",
    progress: 66,
    prompt,
    grounding: false,
    mode: "hooks",
    project,
  });
  if (!result) return;
  els.hooksOutput.value = result;
  saveOutputs({ hooks: result });
  activateTab("hooks");
}

async function generateArticle() {
  const project = prepareProjectOrWarn();
  if (!project) return;

  const totalLength = project.targetLength || 10000;
  const chunks = getChunkCount(totalLength, project.performanceMode);
  const chunkTarget = Math.round(totalLength / chunks);
  const sections = [];
  els.articleOutput.value = "";
  activateTab("article");
  setBusy(true);
  showProgress("全文生成を開始", 8);

  try {
    for (let index = 0; index < chunks; index += 1) {
      const percent = 18 + Math.round(((index + 1) / chunks) * 60);
      showProgress(`${index + 1}/${chunks} セクション生成中`, percent);
      const prompt = buildArticlePrompt({
        project,
        research: els.researchOutput.value,
        outline: els.outlineOutput.value,
        hooks: els.hooksOutput.value,
        chunkIndex: index,
        chunks,
        chunkTarget,
        previousSections: sections.join("\n\n"),
      });

      const result = await callProvider(prompt, false, { mode: "article", project });
      sections.push(result);
      els.articleOutput.value = sections.join("\n\n");
      if (index < chunks - 1) await sleep(project.performanceMode ? 650 : 250);
    }

    showProgress("全体整形中", 94);
    const stitched = sections.join("\n\n");
    els.articleOutput.value = stitched;
    saveOutputs({ article: stitched });
    finishProgress("全文生成が完了しました");
  } catch (error) {
    console.error(error);
    finishProgress("全文生成で停止しました", true);
    showToast(error.message || "全文生成に失敗しました", true);
  } finally {
    setBusy(false);
  }
}

async function guardedGeneration({ stage, progress, prompt, grounding, mode, project, retryLabel }) {
  if (state.isGenerating) {
    showToast("別の生成処理が進行中です。完了後に再実行してください", true);
    return null;
  }

  setBusy(true);
  try {
    showProgress(stage, progress);
    const result = await callProvider(prompt, grounding, { mode, project, retryLabel });
    finishProgress(`${stage} 完了`);
    return result;
  } catch (error) {
    console.error(error);
    finishProgress("エラーが発生しました", true);
    showToast(error.message || "生成に失敗しました", true);
    return null;
  } finally {
    setBusy(false);
  }
}

async function callProvider(prompt, grounding = false, options = {}) {
  const settings = state.providerSettings;
  const cacheKey = buildRequestCacheKey(settings, prompt, grounding, options.mode);
  if (requestCache.has(cacheKey)) return requestCache.get(cacheKey);

  let result;
  if (settings.provider === "gemini") {
    if (!settings.geminiApiKey) {
      throw new Error("先にAPI設定でGeminiキーを入力してください");
    }
    result = await callGemini(settings.geminiApiKey, settings.geminiModel, prompt, grounding, options);
  } else {
    if (!settings.compatEndpoint || !settings.compatApiKey) {
      throw new Error("互換エンドポイントURLとAPIキーを入力してください");
    }
    result = await callCompatibleEndpoint(settings, prompt, options);
  }

  requestCache.set(cacheKey, result);
  return result;
}

async function callGemini(apiKey, model, prompt, grounding, options = {}) {
  const tuning = getTuning(options.mode, options.project);
  const retries = options.project?.autoRetry === false ? 0 : tuning.retries;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), tuning.timeoutMs);

    try {
      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: tuning.temperature,
          topP: tuning.topP,
          maxOutputTokens: tuning.maxOutputTokens,
        },
      };

      if (grounding) {
        payload.tools = [{ google_search: {} }];
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!response.ok) {
        const rawText = await response.text();
        const retryable = [429, 500, 503, 504].includes(response.status);

        if (retryable && attempt < retries) {
          showProgress(`混雑中のため再試行 ${attempt + 1}/${retries}`, 24 + (attempt * 8));
          await sleep(getRetryDelay(attempt));
          continue;
        }

        if (grounding && response.status === 503 && options.mode === "research") {
          showProgress(options.retryLabel || "混雑のため軽量リサーチへ切替", 28);
          return callGemini(apiKey, model, prompt, false, {
            ...options,
            retryLabel: null,
          });
        }

        throw new Error(normalizeGeminiError(response.status, rawText, options.mode));
      }

      const data = await response.json();
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const text = parts.map((part) => part.text || "").join("\n").trim();
      if (!text) throw new Error("Geminiの応答が空でした。少し待ってから再試行してください。");

      const sources = grounding ? extractGeminiSources(data) : "";
      return sources ? `${text}\n\n---\n参照候補\n${sources}` : text;
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      const isAbort = error?.name === "AbortError";
      const isNetwork = error instanceof TypeError;
      const retryable = isAbort || isNetwork;

      if (retryable && attempt < retries) {
        showProgress(`応答待機中のため再試行 ${attempt + 1}/${retries}`, 24 + (attempt * 8));
        await sleep(getRetryDelay(attempt));
        continue;
      }

      if (isAbort) {
        throw new Error("応答が長すぎたため中断しました。文字数を下げるか、安定優先モードをONにしてください。");
      }
      if (isNetwork) {
        throw new Error("通信が不安定です。接続を確認してから再試行してください。");
      }
      throw error;
    }
  }

  throw lastError || new Error("Gemini応答で不明なエラーが発生しました");
}

function getTuning(mode, project = {}) {
  const stable = project.performanceMode !== false;
  const table = {
    research: stable
      ? { temperature: 0.45, topP: 0.88, maxOutputTokens: 1600, timeoutMs: 22000, retries: 2 }
      : { temperature: 0.62, topP: 0.92, maxOutputTokens: 2400, timeoutMs: 30000, retries: 2 },
    outline: stable
      ? { temperature: 0.5, topP: 0.9, maxOutputTokens: 1900, timeoutMs: 22000, retries: 2 }
      : { temperature: 0.68, topP: 0.94, maxOutputTokens: 2800, timeoutMs: 32000, retries: 2 },
    hooks: stable
      ? { temperature: 0.58, topP: 0.9, maxOutputTokens: 1700, timeoutMs: 22000, retries: 2 }
      : { temperature: 0.78, topP: 0.95, maxOutputTokens: 2400, timeoutMs: 32000, retries: 2 },
    article: stable
      ? { temperature: 0.72, topP: 0.9, maxOutputTokens: 2600, timeoutMs: 28000, retries: 2 }
      : { temperature: 0.82, topP: 0.94, maxOutputTokens: 3400, timeoutMs: 38000, retries: 2 },
  };
  return table[mode || "article"];
}

function getChunkCount(totalLength, stable = true) {
  if (totalLength <= 6000) return 1;
  if (totalLength <= 14000) return 2;
  if (totalLength <= 26000) return stable ? 3 : 2;
  return 4;
}

function buildRequestCacheKey(settings, prompt, grounding, mode) {
  return [settings.provider, settings.geminiModel || settings.compatModel || "", grounding ? "g" : "n", mode || "generic", simpleHash(prompt)].join("::");
}

function simpleHash(value) {
  let hash = 0;
  const input = String(value || "");
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}

function getRetryDelay(attempt) {
  return Math.min(5000, 1200 * (attempt + 1));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeGeminiError(status, rawText, mode) {
  const text = String(rawText || "");
  if (status === 429) return "短時間のリクエストが多いため一時的に制限されています。30〜60秒ほど空けて再試行してください。";
  if (status === 503) return mode === "research"
    ? "Gemini側が混雑しています。少し待ってから再試行してください。最新Web参照はOFFの方が安定します。"
    : "Gemini側が混雑しています。少し待ってから再試行してください。";
  if (status === 400) return text.includes("API key") ? "APIキーの形式を確認してください。" : "送信内容が重すぎるか不正です。文字数や入力内容を少し軽くしてください。";
  if (status === 403) return "APIキーの権限または利用設定を確認してください。";
  if (status >= 500) return "Gemini側の一時エラーです。時間を空けて再試行してください。";
  return `Geminiでエラーが発生しました（${status}）。`;
}

async function callCompatibleEndpoint(settings, prompt, options = {}) {
  const tuning = getTuning(options.mode, options.project);
  const response = await fetch(settings.compatEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.compatApiKey}`,
    },
    body: JSON.stringify({
      model: settings.compatModel,
      messages: [
        {
          role: "system",
          content: "You are an elite Japanese note strategist and writer. Output natural Japanese with no AI-like filler.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: tuning.temperature,
      max_tokens: tuning.maxOutputTokens,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`互換APIエラー: ${response.status} ${text}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("互換APIの応答が空でした");
  return text;
}

function setBusy(isBusy) {
  state.isGenerating = isBusy;
  [
    els.runResearchBtn,
    els.buildOutlineBtn,
    els.generateHooksBtn,
    els.generateArticleBtn,
    els.saveProjectBtn,
    els.duplicateProjectBtn,
    els.deleteProjectBtn,
  ].forEach((button) => {
    if (button) button.disabled = isBusy;
  });
}

function prepareProjectOrWarn() {
  saveProjectFromForm();
  const project = collectProjectFromForm();
  if (!project.title || !project.theme) {
    showToast("案件名と主題を入力してください", true);
    return null;
  }
  return project;
}

function saveOutputs(nextOutputs) {
  if (!state.projectId) return;
  const vault = getVault();
  const index = vault.projects.findIndex((item) => item.id === state.projectId);
  if (index < 0) return;
  vault.projects[index].outputs = {
    ...defaultOutputs(),
    ...(vault.projects[index].outputs || {}),
    ...nextOutputs,
  };
  vault.projects[index].updatedAt = new Date().toISOString();
  saveVault(vault);
  renderHistory();
}

function showProgress(label, percent) {
  els.progressBox.classList.remove("hidden");
  els.progressLabel.textContent = label;
  els.progressFill.style.width = `${percent}%`;
}

function finishProgress(label, isError = false) {
  els.progressLabel.textContent = label;
  els.progressFill.style.width = isError ? "100%" : "100%";
  setTimeout(() => {
    els.progressBox.classList.add("hidden");
    els.progressFill.style.width = "0%";
  }, 900);
}

function activateTab(name) {
  els.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === name));
  els.panels.forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === name));
}

function getActiveOutput() {
  const activePanel = document.querySelector(".tab-panel.active");
  if (!activePanel) return "";
  const textarea = activePanel.querySelector("textarea");
  return textarea ? textarea.value : "";
}

async function copyActiveOutput() {
  const text = getActiveOutput();
  if (!text) {
    showToast("コピーする内容がありません", true);
    return;
  }
  await navigator.clipboard.writeText(text);
  showToast("コピーしました");
}

function exportText(type) {
  const project = collectProjectFromForm();
  const titleBase = project.title || "note-forge-output";
  const text = type === "html" ? buildHtmlExport(project) : buildMarkdownExport(project);
  const extension = type === "html" ? "html" : "md";
  downloadFile(`${sanitizeFilename(titleBase)}.${extension}`, text, type === "html" ? "text/html" : "text/markdown");
}

function buildMarkdownExport(project) {
  return `# ${project.title || "無題"}\n\n## Research\n\n${els.researchOutput.value}\n\n## Outline\n\n${els.outlineOutput.value}\n\n## Hooks\n\n${els.hooksOutput.value}\n\n## Article\n\n${els.articleOutput.value}`;
}

function buildHtmlExport(project) {
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(project.title || "無題")}</title><style>body{font-family:Inter,system-ui,sans-serif;margin:32px auto;max-width:900px;line-height:1.8;padding:0 16px;color:#112}h1,h2{line-height:1.25}pre{white-space:pre-wrap;font:inherit}</style></head><body><h1>${escapeHtml(project.title || "無題")}</h1><h2>Research</h2><pre>${escapeHtml(els.researchOutput.value)}</pre><h2>Outline</h2><pre>${escapeHtml(els.outlineOutput.value)}</pre><h2>Hooks</h2><pre>${escapeHtml(els.hooksOutput.value)}</pre><h2>Article</h2><pre>${escapeHtml(els.articleOutput.value)}</pre></body></html>`;
}

function exportVaultJson() {
  if (!state.passcode) {
    showToast("先にログインしてください", true);
    return;
  }
  const vault = getVault();
  downloadFile(`noteforgex-${state.passcode}.json`, JSON.stringify(vault, null, 2), "application/json");
}

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function showToast(message, isError = false) {
  els.toast.textContent = message;
  els.toast.classList.remove("hidden");
  els.toast.style.borderColor = isError ? "rgba(255,127,157,0.35)" : "rgba(127,209,255,0.25)";
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => els.toast.classList.add("hidden"), isError ? 4200 : 2200);
}

function formatDate(isoString) {
  const date = new Date(isoString);
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function sanitizeFilename(value) {
  return value.replace(/[\\/:*?"<>|]/g, "-").slice(0, 80) || "export";
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildResearchPrompt(project) {
  return `
あなたは、日本のnote販売に強いトップクラスのリサーチャー兼編集者です。

目的:
${project.goal || "note販売"}

ジャンル:
${project.genre}

テーマ:
${project.theme}

読者像:
${project.targetReader || "未設定"}

独自情報:
${project.uniqueness || "未設定"}

参考メモ / URL / 競合候補:
${project.researchSeed || "未設定"}

心理トリガー:
${project.psychTriggers.join("、") || "未設定"}

要件:
- 最新のWeb情報も踏まえて、noteで売れやすい切り口を分析
- 読者の悩み、検索/閲覧意図、課金理由を抽出
- タイトル傾向、導入フック傾向、購入に繋がりやすい構成傾向を整理
- 差別化の余地を明確化
- 胡散臭い表現、審査や信頼面で不利な表現も指摘
- 日本語で自然に、実務で使える粒度で書く
- 出力は次の見出しで整理

出力形式:
1. 市場温度感
2. 読者の核心ニーズ
3. 売れ筋切り口5本
4. タイトル傾向
5. 導入フック傾向
6. 売れやすい構成要素
7. 差別化戦略
8. 避けるべき表現
9. 推奨コンセプト1本
`.trim();
}

function buildOutlinePrompt(project, research) {
  return `
あなたは、note販売に強い戦略編集者です。
以下の条件をもとに、売れる確率を高める長文noteの設計図を作ってください。

案件情報:
- タイトル候補の軸: ${project.title}
- ジャンル: ${project.genre}
- テーマ: ${project.theme}
- 読者像: ${project.targetReader || "未設定"}
- ゴール: ${project.goal || "note販売"}
- 文量: ${project.targetLength}文字
- トーン: ${project.tone}
- フレーム: ${project.framework}
- 心理トリガー: ${project.psychTriggers.join("、")}
- 独自情報: ${project.uniqueness || "未設定"}

リサーチ結果:
${research || "未実行"}

要件:
- 章立ては全体の文量に見合う本数で作る
- 無料で読ませる前半と、有料で価値を感じさせる後半の設計も入れる
- 章ごとに目的、扱う内容、感情の動き、販売導線の役割を明記
- AIっぽい量産構成ではなく、日本人が自然に読み進められる流れにする
- 実体験がない箇所を断定で盛らない

出力形式:
1. コンセプト要約
2. 想定タイトル軸
3. 無料パート設計
4. 有料パート設計
5. 章ごとの構成表
6. CTA挿入位置
7. 特典や導線の差し込み案
`.trim();
}

function buildHooksPrompt(project, research, outline) {
  return `
あなたは、売れるnoteのタイトル設計と冒頭設計に強いコピーライターです。

案件情報:
- テーマ: ${project.theme}
- 読者像: ${project.targetReader || "未設定"}
- ゴール: ${project.goal || "note販売"}
- トーン: ${project.tone}
- 心理トリガー: ${project.psychTriggers.join("、")}

リサーチ:
${research || "未実行"}

構成:
${outline || "未実行"}

出力要件:
- タイトル案を10本
- 各タイトルに狙いを1行
- 冒頭導入を3パターン
- 有料へ自然に繋ぐブリッジ文を5本
- 購入前不安を潰すCTAを5本
- 日本語は自然で、AI感が出る定型句は避ける
`.trim();
}

function buildArticlePrompt({ project, research, outline, hooks, chunkIndex, chunks, chunkTarget, previousSections }) {
  return `
あなたは、日本語の長文noteを売れる品質で仕上げるプロ編集者兼ライターです。

今回書くのは全${chunks}分割中の第${chunkIndex + 1}パートです。
このパートの目安文字数は約${chunkTarget}文字です。

執筆ルール:
- 不自然なAI定型表現、過剰な箇条書き、機械的な締めを避ける
- 体験談っぽい熱量と、再現性のある解説を両立する
- 同じ言い回しを繰り返さない
- 余白のある自然な日本語にする
- 売り込み臭を出しすぎず、でも価値は明確に伝える
- 章見出しを適宜入れる
- このパート単体でも読めるが、全体として繋がるようにする

案件情報:
- テーマ: ${project.theme}
- ジャンル: ${project.genre}
- 読者像: ${project.targetReader || "未設定"}
- ゴール: ${project.goal || "note販売"}
- 文量: ${project.targetLength}
- トーン: ${project.tone}
- フレーム: ${project.framework}
- 心理トリガー: ${project.psychTriggers.join("、")}
- 独自情報: ${project.uniqueness || "未設定"}

リサーチ:
${research || "未実行"}

構成:
${outline || "未実行"}

タイトル・導入・CTA案:
${hooks || "未実行"}

これまでに生成済みの本文:
${previousSections || "まだなし"}

指示:
- 第${chunkIndex + 1}パートとして自然につながる本文だけを出力
- メタ説明は不要
- 文字数は十分に出す
- 中身のない冗長さではなく、読ませる密度を優先
`.trim();
}
