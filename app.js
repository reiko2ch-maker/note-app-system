(() => {
  'use strict';

  const VERSION = '4.0.0-pro';
  const els = {};
  let workspaceId = '';
  let activeTab = 'research';
  let activeStep = 'setup';
  let abortController = null;
  let outputs = { research: '', outline: '', hooks: '', article: '', prompt: '' };
  let lastRequestAt = 0;

  const q = (id) => document.getElementById(id);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    [
      'loginView','appView','passcode','makePasscode','enterWorkspace','resetWorkspace','apiKey','toggleKey','apiStatus','modelName','stableMode','autoRetry','webGrounding','historyList','historyCount','topic','genre','reader','goal','length','tone','framework','quality','unique','saveDraft','runStatus','runResearch','runOutline','runHooks','runArticle','makeClaudePrompt','makeGptPrompt','progressBox','progressText','progressBar','cancelRun','outputBox','copyOutput','downloadMd','downloadHtml','saveHistory','clearOutput','toast'
    ].forEach((id) => { els[id] = q(id); });

    els.makePasscode.addEventListener('click', () => { els.passcode.value = String(Math.floor(10000000 + Math.random() * 90000000)); });
    els.enterWorkspace.addEventListener('click', enterWorkspace);
    els.passcode.addEventListener('input', () => { els.passcode.value = els.passcode.value.replace(/\D/g, '').slice(0, 8); });
    els.resetWorkspace.addEventListener('click', () => { sessionStorage.removeItem('nfx_workspace'); location.reload(); });
    els.toggleKey.addEventListener('click', toggleKey);
    els.apiKey.addEventListener('input', syncApiKey);

    document.querySelectorAll('.step-btn').forEach((b) => b.addEventListener('click', () => setStep(b.dataset.step)));
    document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));

    els.saveDraft.addEventListener('click', saveDraft);
    els.runResearch.addEventListener('click', () => runTask('research'));
    els.runOutline.addEventListener('click', () => runTask('outline'));
    els.runHooks.addEventListener('click', () => runTask('hooks'));
    els.runArticle.addEventListener('click', () => runTask('article'));
    els.makeClaudePrompt.addEventListener('click', () => makeExternalPrompt('claude'));
    els.makeGptPrompt.addEventListener('click', () => makeExternalPrompt('gpt'));
    els.cancelRun.addEventListener('click', cancelRun);
    els.copyOutput.addEventListener('click', copyCurrent);
    els.downloadMd.addEventListener('click', () => downloadCurrent('md'));
    els.downloadHtml.addEventListener('click', () => downloadCurrent('html'));
    els.saveHistory.addEventListener('click', saveHistory);
    els.clearOutput.addEventListener('click', clearOutput);

    const savedWorkspace = sessionStorage.getItem('nfx_workspace');
    if (savedWorkspace && /^\d{8}$/.test(savedWorkspace)) {
      workspaceId = savedWorkspace;
      showApp();
    }
    const savedKey = sessionStorage.getItem('nfx_api_key');
    if (savedKey) els.apiKey.value = savedKey;
    updateApiStatus();
    setTab('research');
    console.info(`Note Forge X Pro v${VERSION}`);
  }

  function enterWorkspace() {
    const code = els.passcode.value.trim();
    if (!/^\d{8}$/.test(code)) return toast('8桁の数字を入力してください。');
    workspaceId = code;
    sessionStorage.setItem('nfx_workspace', workspaceId);
    showApp();
  }

  function showApp() {
    els.loginView.classList.add('hidden');
    els.appView.classList.remove('hidden');
    loadDraft();
    renderHistory();
  }

  function toggleKey() {
    els.apiKey.type = els.apiKey.type === 'password' ? 'text' : 'password';
    els.toggleKey.textContent = els.apiKey.type === 'password' ? '表示' : '非表示';
  }

  function syncApiKey() {
    const key = els.apiKey.value.trim();
    if (key) sessionStorage.setItem('nfx_api_key', key);
    else sessionStorage.removeItem('nfx_api_key');
    updateApiStatus();
  }

  function updateApiStatus() {
    const ok = Boolean(getApiKey());
    els.apiStatus.textContent = ok ? '接続準備OK' : '未設定';
    els.apiStatus.className = `status-pill ${ok ? 'ok' : 'warn'}`;
  }

  function getApiKey() { return (els.apiKey.value || sessionStorage.getItem('nfx_api_key') || '').trim(); }
  function storageKey(name) { return `nfx_${VERSION}_${workspaceId}_${name}`; }

  function setStep(step) {
    activeStep = step;
    document.querySelectorAll('.step-btn').forEach((b) => b.classList.toggle('active', b.dataset.step === step));
    document.querySelectorAll('.step-panel').forEach((p) => p.classList.toggle('active', p.id === step));
  }

  function setTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    els.outputBox.textContent = outputs[tab] || '生成結果がここに表示されます。';
    if (activeStep !== 'output') setStep('output');
  }

  function collectConfig() {
    return {
      topic: val('topic'),
      genre: val('genre'),
      reader: val('reader'),
      goal: val('goal'),
      length: Number(val('length')) || 5000,
      tone: val('tone'),
      framework: val('framework'),
      quality: val('quality'),
      unique: val('unique'),
      psychology: Array.from(document.querySelectorAll('.psy:checked')).map((e) => e.value),
      stableMode: els.stableMode.checked,
      autoRetry: els.autoRetry.checked,
      webGrounding: els.webGrounding.checked,
      model: val('modelName'),
    };
  }
  function val(id) { return (els[id]?.value || '').trim(); }

  function validateConfig(needsKey = true) {
    if (!val('topic')) { toast('記事タイトル / テーマを入力してください。'); setStep('plan'); return false; }
    if (needsKey && !getApiKey()) { toast('Gemini APIキーを入力してください。'); setStep('setup'); return false; }
    return true;
  }

  function saveDraft() {
    localStorage.setItem(storageKey('draft'), JSON.stringify(collectConfig()));
    toast('下書きを保存しました。', 'ok');
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(storageKey('draft'));
      if (!raw) return;
      const d = JSON.parse(raw);
      ['topic','genre','reader','goal','length','tone','framework','quality','unique','model'].forEach((k) => {
        const id = k === 'model' ? 'modelName' : k;
        if (els[id] && d[k] !== undefined) els[id].value = d[k];
      });
      if (Array.isArray(d.psychology)) {
        document.querySelectorAll('.psy').forEach((e) => { e.checked = d.psychology.includes(e.value); });
      }
    } catch (e) { console.warn(e); }
  }

  async function runTask(type) {
    if (!validateConfig(true)) return;
    if (abortController) return toast('現在生成中です。完了または停止してから再実行してください。');

    const now = Date.now();
    const gap = els.stableMode.checked ? 2200 : 900;
    if (now - lastRequestAt < gap) await sleep(gap - (now - lastRequestAt));
    lastRequestAt = Date.now();

    const cfg = collectConfig();
    abortController = new AbortController();
    lockButtons(true);
    showProgress(true, taskName(type) + 'を開始しています', 4);
    setStatus('生成中', 'warn');

    try {
      let result = '';
      if (type === 'article') result = await generateArticle(cfg);
      else result = await generateStructured(type, cfg);
      outputs[type] = cleanupOutput(result);
      setTab(type);
      toast(`${taskName(type)}が完了しました。`, 'ok');
      setStatus('完了', 'ok');
    } catch (err) {
      const msg = normalizeError(err);
      toast(msg);
      setStatus('待機中', 'ok');
    } finally {
      abortController = null;
      lockButtons(false);
      showProgress(false);
    }
  }

  function taskName(type) {
    return { research: 'リサーチ', outline: '構成', hooks: '導入・CTA', article: '本文' }[type] || '生成';
  }

  async function generateStructured(type, cfg) {
    const prompt = buildPrompt(type, cfg);
    const max = maxTokensFor(type, cfg);
    let text = await geminiGenerate(prompt, { maxOutputTokens: max, temperature: cfg.quality === 'premium' ? 0.75 : 0.55, useWeb: type === 'research' && cfg.webGrounding });
    text = cleanupOutput(text);
    text = await completeIfTruncated(text, buildContinuationPrompt(type, cfg), 2, cfg);
    return text;
  }

  async function generateArticle(cfg) {
    const sections = sectionCount(cfg.length, cfg.quality);
    const parts = [];
    for (let i = 1; i <= sections; i++) {
      updateProgress(`本文 ${i}/${sections} セクション生成中`, Math.round(((i - 1) / sections) * 90) + 5);
      const prompt = buildArticlePartPrompt(cfg, i, sections, parts);
      let part = await geminiGenerate(prompt, { maxOutputTokens: maxTokensFor('article', cfg), temperature: cfg.quality === 'premium' ? 0.78 : 0.58, useWeb: false });
      part = cleanupOutput(part);
      part = await completeIfTruncated(part, buildArticleContinuationPrompt(cfg, i, sections, part), 2, cfg);
      parts.push(part);
      if (cfg.stableMode && i < sections) await sleep(1400);
    }
    updateProgress('全文を整形中', 96);
    return dedupeJoined(parts.join('\n\n'));
  }

  function sectionCount(length, quality) {
    if (quality === 'stable') return length <= 6000 ? 1 : Math.min(4, Math.ceil(length / 6000));
    if (length <= 5000) return 1;
    if (length <= 12000) return 2;
    if (length <= 24000) return 4;
    return 6;
  }

  function maxTokensFor(type, cfg) {
    const stable = cfg.stableMode || cfg.quality === 'stable';
    if (type === 'article') return stable ? 3072 : 4096;
    if (type === 'research') return stable ? 2048 : 3072;
    return stable ? 1800 : 2600;
  }

  function buildPrompt(type, cfg) {
    const base = contextBlock(cfg);
    if (type === 'research') return `${base}\n\n以下のテーマについて、note購入につながるリサーチメモを作成してください。\n条件：\n- 実在の特定noteを断定しない。一般的な市場傾向として分析する。\n- AIっぽい前置きは禁止。\n- 途中で切れないように簡潔かつ濃く書く。\n- 章立ては「市場温度感」「読者の悩み」「売れる切り口」「競合との差別化」「有料化しやすい導線」「注意点」。\n- 各章は実務で使える粒度。`;
    if (type === 'outline') return `${base}\n\n上記条件で、note本文の完成構成を作成してください。\n条件：\n- AIっぽい前置き禁止。\n- ${cfg.framework} の流れを優先。\n- 無料部分と有料部分の境目が分かるようにする。\n- 各章の役割、読者心理、書くべき内容、注意点をセットで出す。\n- そのまま執筆に使える見出し粒度にする。`;
    if (type === 'hooks') return `${base}\n\nタイトル、導入文、CTA、購入不安を消す説明を作成してください。\n条件：\n- タイトル案10本。\n- 導入文は3パターン。\n- 有料部分への自然な導線を3パターン。\n- 誇大表現、断定、怪しい煽りは禁止。\n- 読者が「これは自分向けだ」と感じる自然な文章にする。`;
    return base;
  }

  function contextBlock(cfg) {
    return `あなたは日本のnote販売に強いトップクラスの編集者兼マーケターです。\n\n【テーマ】${cfg.topic}\n【ジャンル】${cfg.genre}\n【想定読者】${cfg.reader || '未設定'}\n【ゴール】${cfg.goal || '未設定'}\n【文量目安】${cfg.length}文字\n【文体】${cfg.tone}\n【構成】${cfg.framework}\n【差別化】${cfg.unique || '未設定'}\n【心理設計】${cfg.psychology.join('、') || '未設定'}\n\n共通ルール：\n- 「はい、承知しました」などの前置きは禁止。\n- AIで生成したと分かる機械的表現を避ける。\n- 薄い一般論ではなく、読者が行動に移せる具体性を入れる。\n- ただし誇大表現、虚偽、規約違反、煽りすぎは避ける。\n- 最後は自然な文末で終える。`;
  }

  function buildArticlePartPrompt(cfg, index, total, parts) {
    const range = total === 1 ? '全文' : `${index}/${total}パート`;
    const prev = parts.length ? `\n\n【直前までの文脈】\n${tail(parts.join('\n\n'), 1200)}` : '';
    return `${contextBlock(cfg)}${prev}\n\nこれからnote本文の${range}を執筆してください。\n条件：\n- 今回のパートだけで自然に読める文章にする。\n- 見出しを使い、スマホで読みやすく改行する。\n- 具体例、注意点、読者心理への寄り添いを入れる。\n- 同じ話の繰り返しは禁止。\n- パート${index}として必要な範囲だけ書く。\n- 最後は文の途中で切らず、自然な文末で終える。\n- 前置きやメタ説明は禁止。`;
  }

  function buildContinuationPrompt(type, cfg) {
    return `${contextBlock(cfg)}\n\n直前の出力が途中で切れている可能性があります。\n続きだけを書いてください。\n条件：前置き禁止、重複禁止、自然な文末で終える。`;
  }

  function buildArticleContinuationPrompt(cfg, index, total, part) {
    return `${contextBlock(cfg)}\n\n本文パート${index}/${total}の続きだけを書いてください。\n【直前の末尾】\n${tail(part, 900)}\n\n条件：前置き禁止、重複禁止、自然な文末で終える。`;
  }

  async function completeIfTruncated(text, continuationPrompt, maxRounds, cfg) {
    let current = text;
    for (let i = 0; i < maxRounds; i++) {
      if (!looksTruncated(current)) break;
      updateProgress(`途中切れを補完中 ${i + 1}/${maxRounds}`, 88 + i * 4);
      await sleep(cfg.stableMode ? 1000 : 350);
      const cont = await geminiGenerate(`${continuationPrompt}\n\n【これまでの末尾】\n${tail(current, 1000)}`, { maxOutputTokens: 1600, temperature: 0.45, useWeb: false });
      current = mergeContinuation(current, cleanupOutput(cont));
    }
    return current;
  }

  function looksTruncated(text) {
    const t = (text || '').trim();
    if (t.length < 40) return true;
    const last = t.slice(-1);
    if ('。！？.!?」』）)'.includes(last)) return false;
    const tailText = t.slice(-80);
    if (/です$|ます$|ください$|まとめ$|以上$/.test(tailText)) return false;
    return true;
  }

  async function geminiGenerate(prompt, options = {}) {
    const key = getApiKey();
    if (!key) throw new Error('NO_API_KEY');
    const model = val('modelName') || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
    const cfg = collectConfig();
    const attempts = cfg.autoRetry ? 3 : 1;
    let lastError = null;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        updateProgress(attempt > 1 ? `再試行中 ${attempt}/${attempts}` : 'Geminiへ送信中', Math.min(82, 15 + attempt * 8));
        const controller = abortController;
        const timeout = setTimeout(() => { try { controller?.abort(); } catch (_) {} }, cfg.stableMode ? 85000 : 65000);
        const body = makeGeminiBody(prompt, options);
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller?.signal });
        clearTimeout(timeout);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw geminiError(res.status, data);
        const text = extractGeminiText(data);
        if (!text) throw new Error('EMPTY_OUTPUT');
        return text;
      } catch (err) {
        lastError = err;
        if (err.name === 'AbortError') throw err;
        if (!shouldRetry(err) || attempt === attempts) break;
        await sleep(1000 * attempt + Math.floor(Math.random() * 500));
      }
    }
    throw lastError || new Error('UNKNOWN_ERROR');
  }

  function makeGeminiBody(prompt, options) {
    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: options.temperature ?? 0.55,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: options.maxOutputTokens || 2048,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ],
    };
    if (options.useWeb) body.tools = [{ google_search: {} }];
    return body;
  }

  function extractGeminiText(data) {
    const parts = data?.candidates?.[0]?.content?.parts || [];
    return parts.map((p) => p.text || '').join('\n').trim();
  }

  function geminiError(status, data) {
    const err = new Error(data?.error?.message || `Gemini error ${status}`);
    err.status = status;
    err.raw = data;
    return err;
  }

  function shouldRetry(err) { return [429, 500, 502, 503, 504].includes(err.status); }

  function normalizeError(err) {
    if (!err) return '不明なエラーです。';
    if (err.name === 'AbortError') return '生成を停止しました。';
    if (err.message === 'NO_API_KEY') return 'Gemini APIキーを入力してください。';
    if (err.message === 'EMPTY_OUTPUT') return '生成結果が空でした。条件を軽くして再実行してください。';
    if ([429, 503].includes(err.status)) return 'Gemini側が混雑、または利用制限に近い状態です。少し待ってから再試行してください。安定優先ON・Web参照OFFがおすすめです。';
    if (err.status === 400) return 'APIリクエストが通りませんでした。モデル名、APIキー、Web参照設定を確認してください。';
    if (err.status === 403) return 'APIキーの権限または利用設定を確認してください。';
    return String(err.message || err);
  }

  function makeExternalPrompt(kind) {
    if (!validateConfig(false)) return;
    const cfg = collectConfig();
    const name = kind === 'claude' ? 'Claude' : 'GPT-5.4';
    const prompt = `あなたは日本のnote販売、長文教材、販売導線設計に強いトップクラスの編集者です。\n\n以下の条件をもとに、note記事本文を高品質に執筆してください。\n\n【使用AI】${name}\n【テーマ】${cfg.topic}\n【ジャンル】${cfg.genre}\n【想定読者】${cfg.reader || '未設定'}\n【ゴール】${cfg.goal || '未設定'}\n【目標文量】${cfg.length}文字前後\n【文体】${cfg.tone}\n【構成】${cfg.framework}\n【差別化】${cfg.unique || '未設定'}\n【心理設計】${cfg.psychology.join('、') || '未設定'}\n\n【リサーチメモ】\n${outputs.research || '未生成'}\n\n【構成案】\n${outputs.outline || '未生成'}\n\n【導入・CTA案】\n${outputs.hooks || '未生成'}\n\n執筆条件：\n1. 「はい、承知しました」などの前置きは不要。\n2. AIっぽい抽象論を避け、実務で使える具体性を入れる。\n3. スマホで読みやすいように適度に改行する。\n4. 誇大表現、虚偽、規約違反、過度な煽りは避ける。\n5. 無料部分と有料部分の導線を自然に設計する。\n6. 最後まで文を切らず、完成原稿として出力する。\n7. 途中で長くなりすぎる場合は、章ごとに区切って続ける前提で出力する。`;
    outputs.prompt = prompt;
    setTab('prompt');
    toast(`${name}用プロンプトを作成しました。`, 'ok');
  }

  function cleanupOutput(text) {
    return (text || '')
      .replace(/^\s*(はい、?承知いたしました。?|承知しました。?|もちろんです。?|以下に.*?作成します。?)\s*/i, '')
      .replace(/^\s*#+\s*回答\s*/i, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function mergeContinuation(base, cont) {
    if (!cont) return base;
    const clean = cleanupOutput(cont);
    const baseTail = tail(base, 240);
    const overlap = findOverlap(baseTail, clean.slice(0, 300));
    if (overlap > 20) return base + clean.slice(overlap);
    return base.replace(/\s+$/,'') + '\n\n' + clean;
  }

  function findOverlap(a, b) {
    const max = Math.min(a.length, b.length, 180);
    for (let n = max; n >= 20; n--) {
      if (a.slice(-n) === b.slice(0, n)) return n;
    }
    return 0;
  }

  function dedupeJoined(text) {
    const paras = text.split(/\n{2,}/);
    const seen = new Set();
    const out = [];
    for (const p of paras) {
      const key = p.replace(/\s+/g, '').slice(0, 80);
      if (!key || seen.has(key)) continue;
      seen.add(key); out.push(p.trim());
    }
    return out.join('\n\n');
  }

  function tail(text, n) { return (text || '').slice(-n); }

  function saveHistory() {
    const cfg = collectConfig();
    const item = { id: Date.now(), createdAt: new Date().toISOString(), title: cfg.topic || '無題', genre: cfg.genre, length: cfg.length, outputs, config: cfg };
    const list = getHistory();
    list.unshift(item);
    localStorage.setItem(storageKey('history'), JSON.stringify(list.slice(0, 30)));
    renderHistory();
    toast('履歴に保存しました。', 'ok');
  }

  function getHistory() {
    try { return JSON.parse(localStorage.getItem(storageKey('history')) || '[]'); } catch { return []; }
  }

  function renderHistory() {
    const list = getHistory();
    els.historyCount.textContent = `${list.length}件`;
    if (!list.length) { els.historyList.textContent = 'まだ保存された履歴はありません。'; els.historyList.classList.add('empty'); return; }
    els.historyList.classList.remove('empty');
    els.historyList.innerHTML = '';
    list.forEach((item) => {
      const el = document.createElement('div');
      el.className = 'history-item';
      el.innerHTML = `<h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.genre)} ・ ${escapeHtml(String(item.length))}文字 ・ ${formatDate(item.createdAt)}</p><div class="history-actions"><button class="ghost-btn small" data-act="load">呼び出す</button><button class="ghost-btn small" data-act="copy">複製</button><button class="ghost-btn small" data-act="delete">削除</button></div>`;
      el.querySelector('[data-act="load"]').addEventListener('click', () => loadHistoryItem(item));
      el.querySelector('[data-act="copy"]').addEventListener('click', () => { navigator.clipboard?.writeText(item.outputs.article || item.outputs.research || ''); toast('コピーしました。', 'ok'); });
      el.querySelector('[data-act="delete"]').addEventListener('click', () => deleteHistoryItem(item.id));
      els.historyList.appendChild(el);
    });
  }

  function loadHistoryItem(item) {
    outputs = Object.assign({ research: '', outline: '', hooks: '', article: '', prompt: '' }, item.outputs || {});
    const c = item.config || {};
    Object.entries(c).forEach(([k, v]) => {
      const id = k === 'model' ? 'modelName' : k;
      if (els[id] && typeof v !== 'object') els[id].value = v;
    });
    setTab('article');
    toast('履歴を呼び出しました。', 'ok');
  }

  function deleteHistoryItem(id) {
    const list = getHistory().filter((x) => x.id !== id);
    localStorage.setItem(storageKey('history'), JSON.stringify(list));
    renderHistory();
  }

  function clearOutput() {
    outputs[activeTab] = '';
    els.outputBox.textContent = '生成結果がここに表示されます。';
  }

  async function copyCurrent() {
    const text = outputs[activeTab] || '';
    if (!text) return toast('コピーできる出力がありません。');
    await navigator.clipboard.writeText(text);
    toast('コピーしました。', 'ok');
  }

  function downloadCurrent(format) {
    const text = outputs[activeTab] || '';
    if (!text) return toast('ダウンロードできる出力がありません。');
    const title = (val('topic') || 'note-forge-output').replace(/[\\/:*?"<>|]/g, '-');
    const content = format === 'html' ? `<!doctype html><meta charset="utf-8"><title>${escapeHtml(title)}</title><article>${markdownToHtml(text)}</article>` : text;
    const type = format === 'html' ? 'text/html' : 'text/markdown';
    const blob = new Blob([content], { type: `${type};charset=utf-8` });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${title}.${format === 'html' ? 'html' : 'md'}`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function markdownToHtml(md) {
    return escapeHtml(md).replace(/^### (.*)$/gm, '<h3>$1</h3>').replace(/^## (.*)$/gm, '<h2>$1</h2>').replace(/^# (.*)$/gm, '<h1>$1</h1>').replace(/\n\n/g, '</p><p>').replace(/^/, '<p>').replace(/$/, '</p>');
  }

  function lockButtons(locked) {
    ['runResearch','runOutline','runHooks','runArticle','makeClaudePrompt','makeGptPrompt'].forEach((id) => els[id].disabled = locked);
  }

  function cancelRun() {
    if (abortController) abortController.abort();
  }

  function showProgress(show, text = '', pct = 0) {
    els.progressBox.classList.toggle('hidden', !show);
    if (show) updateProgress(text, pct);
  }

  function updateProgress(text, pct) {
    els.progressText.textContent = text;
    els.progressBar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  }

  function setStatus(text, type) {
    els.runStatus.textContent = text;
    els.runStatus.className = `status-pill ${type || ''}`;
  }

  function toast(message, type = '') {
    els.toast.textContent = message;
    els.toast.className = `toast ${type}`;
    els.toast.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => els.toast.classList.add('hidden'), 4200);
  }

  function formatDate(iso) {
    try { return new Intl.DateTimeFormat('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)); } catch { return ''; }
  }

  function escapeHtml(s) { return String(s || '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m])); }
})();
