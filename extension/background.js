const SERVICES = ["CHATGPT", "CLAUDE", "GEMINI"];
const SERVICE_LABELS = { CHATGPT: "ChatGPT", CLAUDE: "Claude", GEMINI: "Gemini" };
const SERVICE_URLS = {
  CHATGPT: "https://chatgpt.com/",
  CLAUDE: "https://claude.ai/new",
  GEMINI: "https://gemini.google.com/app",
};
const SERVICE_URL_PATTERNS = {
  CHATGPT: ["https://chatgpt.com/*"],
  CLAUDE: ["https://claude.ai/*"],
  GEMINI: ["https://gemini.google.com/*"],
};

const DEFAULT_ROLES = {
  chatgpt: `당신은 이 대화방의 ChatGPT입니다.

새로운 가능성을 제시하되, 추상적인 응원에 그치지 말고
실행 가능한 방법을 제시하세요.

다른 참가자의 의견에서 좋은 부분은 인정하고,
수정할 부분이 있다면 구체적으로 보완하세요.`,
  claude: `당신은 이 대화방의 Claude입니다.

다른 참가자들의 의견을 냉정하게 검토하세요.
단순히 반대하기 위한 반대는 하지 말고,
논리적 허점, 실행 위험, 숨겨진 전제를 찾아 설명하세요.

문제를 지적했다면 가능한 대안도 함께 제시하세요.`,
  gemini: `당신은 이 대화방의 Gemini입니다.

앞선 참가자들의 의견을 종합하고,
서로 충돌하는 주장을 구분하여 정리하세요.

단순 요약에 그치지 말고 어떤 선택이 더 현실적인지 판단하고,
그 이유를 명확하게 설명하세요.`,
  commonRules: `[대화 규칙]
1. 사용자에게만 독립적으로 답하지 마세요.
2. 다른 참가자의 발언을 읽고 자연스럽게 이어서 말하세요.
3. 필요한 경우 다른 AI의 의견에 동의하거나 반박하세요.
4. 이미 나온 내용을 그대로 반복하지 마세요.
5. 실제 여러 사람이 대화하는 것처럼 자연스럽게 말하세요.
6. 자신의 이름을 매 문장마다 반복하지 마세요.
7. 현재 요청에 필요한 내용만 말하세요.
8. 다른 참가자의 의견이 틀렸다고 판단하면 이유를 설명하세요.
9. 사용자가 특정 참가자를 지목했다면 그 요청을 우선하세요.
10. 답변 마지막에 불필요한 추가 제안이나 영업성 문구를 넣지 마세요.`,
};

const DEFAULT_SETTINGS = {
  userName: "사용자",
  roomTitle: "AI 원탁회의",
  defaultMode: "ROUNDTABLE",
  speakingOrder: ["CHATGPT", "CLAUDE", "GEMINI"],
  services: {
    CHATGPT: { enabled: true, url: SERVICE_URLS.CHATGPT },
    CLAUDE: { enabled: true, url: SERVICE_URLS.CLAUDE },
    GEMINI: { enabled: true, url: SERVICE_URLS.GEMINI },
  },
  personas: {
    CHATGPT: "",
    CLAUDE: "",
    GEMINI: "",
  },
  avatars: {
    USER: "",
    CHATGPT: "assets/chatgpt.jpg",
    CLAUDE: "assets/claude.jpg",
    GEMINI: "assets/gemini.jpg",
  },
  roles: DEFAULT_ROLES,
  maxContextMessages: 12,
  maxContextChars: 24000,
  responseTimeoutMs: 180000,
  stabilizeMs: 3000,
  delayBetweenMs: 1200,
  maxCascadeResponses: 9,
  allowSendWhileGenerating: false,
  autoSave: true,
};

const OUTPUT_STYLE_RULES = `[출력 형식]
- 내부 사고 과정, 분석 제목, 체크리스트 제목, "생각해보는 중" 같은 메타 문구를 출력하지 마세요.
- "나는 지금 역할을 수행하겠다"처럼 역할 수행을 설명하지 말고, 바로 실제 대화방의 한 참가자처럼 말하세요.
- 사용자가 형식을 요구하지 않았다면 목록보다 자연스러운 대화체 문장을 우선하세요.`;

let busy = false;
let abortRequested = false;

chrome.action.onClicked.addListener(() => openApp());
chrome.runtime.onInstalled.addListener(() => openApp());

async function openApp() {
  const url = chrome.runtime.getURL("app.html");
  const tabs = await chrome.tabs.query({ url });
  if (tabs[0]?.id) {
    await chrome.tabs.update(tabs[0].id, { active: true });
    if (tabs[0].windowId) await chrome.windows.update(tabs[0].windowId, { focused: true });
    return;
  }
  await chrome.tabs.create({ url });
}

function id() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function now() {
  return new Date().toISOString();
}

async function storageGet(keys) {
  return chrome.storage.local.get(keys);
}

async function storageSet(obj) {
  return chrome.storage.local.set(obj);
}

function createRoom(settings = structuredClone(DEFAULT_SETTINGS)) {
  const createdAt = now();
  return {
    id: id(),
    title: settings.roomTitle,
    createdAt,
    updatedAt: createdAt,
    mode: settings.defaultMode,
    settings,
    deliveryCursors: Object.fromEntries(SERVICES.map((service) => [service, 0])),
    messages: [],
  };
}

async function getRoom() {
  const data = await storageGet(["room"]);
  if (data.room) {
    data.room.deliveryCursors ||= Object.fromEntries(SERVICES.map((service) => [service, 0]));
    data.room.settings = normalizeSettings(data.room.settings);
    return data.room;
  }
  const room = createRoom();
  await storageSet({ room });
  return room;
}

function normalizeSettings(settings = {}) {
  return {
    ...structuredClone(DEFAULT_SETTINGS),
    ...settings,
    services: { ...structuredClone(DEFAULT_SETTINGS.services), ...(settings.services || {}) },
    personas: { ...structuredClone(DEFAULT_SETTINGS.personas), ...(settings.personas || {}) },
    avatars: mergeAvatarDefaults(settings.avatars || {}),
    roles: { ...structuredClone(DEFAULT_SETTINGS.roles), ...(settings.roles || {}) },
  };
}

function mergeAvatarDefaults(avatars) {
  const defaults = structuredClone(DEFAULT_SETTINGS.avatars);
  for (const [key, value] of Object.entries(avatars)) {
    defaults[key] = value || defaults[key] || "";
  }
  return defaults;
}

async function saveRoom(room) {
  room.updatedAt = now();
  if (room.settings.autoSave) await storageSet({ room });
}

function emit(event) {
  chrome.runtime.sendMessage({ channel: "roundtable-event", event }).catch(() => {});
}

function progress(text) {
  emit({ type: "PROGRESS", text });
}

function speakerLabel(speaker, userName) {
  if (speaker === "USER") return userName || "사용자";
  return SERVICE_LABELS[speaker] || speaker;
}

function roleKey(service) {
  return { CHATGPT: "chatgpt", CLAUDE: "claude", GEMINI: "gemini" }[service];
}

function personaBlock(target, settings) {
  const persona = settings.personas?.[target]?.trim();
  if (!persona) return "";
  return [
    `[${SERVICE_LABELS[target]}의 말투/컨셉]`,
    persona,
    "위 컨셉은 말투와 태도에 반영하되, 답변의 정확성과 대화 규칙을 해치지 마세요.",
    "",
  ].join("\n");
}

function usableMessages(messages) {
  return messages.filter((m) => m.speaker !== "SYSTEM" && (m.status === "COMPLETED" || m.speaker === "USER"));
}

function unreadMessagesFor(room, service) {
  const cursor = Number(room.deliveryCursors?.[service] || 0);
  return usableMessages(room.messages.slice(cursor)).filter((message) => message.speaker !== service);
}

function hasUnreadFor(room, service) {
  return unreadMessagesFor(room, service).length > 0;
}

function markReadBy(room, service) {
  const readAt = now();
  const changed = [];
  for (const message of unreadMessagesFor(room, service)) {
    message.readBy ||= {};
    if (!message.readBy[service]) {
      message.readBy[service] = readAt;
      changed.push(message);
    }
  }
  if (changed.length) emit({ type: "READ_RECEIPTS_CHANGED", service, messages: changed });
}

function renderMessageBlock(message, settings) {
  return `${speakerLabel(message.speaker, settings.userName)}:\n${message.content}`;
}

function trimMessagesToFit(messages, settings, assemble) {
  let list = [...messages];
  let prompt = assemble(list, list.length < messages.length);
  while (prompt.length > settings.maxContextChars && list.length > 1) {
    list = list.slice(1);
    prompt = assemble(list, true);
  }
  return prompt;
}

function buildInitialPrompt(target, messages, settings) {
  const targetLabel = SERVICE_LABELS[target];
  const header = [
    `당신은 사용자, ChatGPT, Claude, Gemini가 참여하는 공용 대화방에`,
    `${targetLabel} 역할로 참여하고 있습니다.`,
    "",
    "[참가자]",
    "- 사용자: 고민과 질문을 이야기하는 사람",
    "- ChatGPT: 새로운 가능성과 실행 방안을 제안하는 참가자",
    "- Claude: 논리적인 허점, 위험, 모순을 검토하는 참가자",
    "- Gemini: 정보를 보완하고 의견을 종합하는 참가자",
    "",
    settings.roles.commonRules,
    "",
    OUTPUT_STYLE_RULES,
    "",
    `[${targetLabel}의 역할]`,
    settings.roles[roleKey(target)],
    "",
    personaBlock(target, settings),
  ].join("\n");

  const usable = usableMessages(messages);
  const firstUser = usable.find((m) => m.speaker === "USER");
  let recent = usable.slice(-settings.maxContextMessages);

  function assemble(list, includeTopic, truncated) {
    const parts = [header];
    if (includeTopic && firstUser && !list.includes(firstUser)) {
      parts.push("[대화 주제]", renderMessageBlock(firstUser, settings), "");
    }
    if (truncated) {
      parts.push("[안내] 이 대화는 오래 진행되어 일부 초기 발언이 생략되었습니다.", "");
    }
    parts.push("[지금까지의 대화]", "", list.map((m) => renderMessageBlock(m, settings)).join("\n\n"), "", `이제 ${targetLabel}의 입장에서 자연스럽게 대화에 참여하세요.`);
    return parts.join("\n");
  }

  let truncated = usable.length > recent.length;
  let prompt = assemble(recent, firstUser && !recent.includes(firstUser), truncated);
  while (prompt.length > settings.maxContextChars && recent.length > 1) {
    recent = recent.slice(1);
    truncated = true;
    prompt = assemble(recent, firstUser && !recent.includes(firstUser), truncated);
  }
  return prompt;
}

function buildDeltaPrompt(target, messages, settings, cursor) {
  const targetLabel = SERVICE_LABELS[target];
  const delta = usableMessages(messages.slice(cursor));
  if (delta.length === 0) {
    return `새로 전달할 발언은 없습니다. ${targetLabel}의 입장에서 짧게 이어서 말하세요.`;
  }

  return trimMessagesToFit(delta, settings, (list, truncated) => {
    const parts = [
      `[새로 추가된 대화]`,
      `${targetLabel}의 기존 채팅방에는 이전 맥락이 이미 있습니다. 아래 새 발언만 반영해서 자연스럽게 이어서 답하세요.`,
      "",
      OUTPUT_STYLE_RULES,
      "",
      personaBlock(target, settings),
      "",
    ];
    if (truncated) {
      parts.push("[안내] 새 발언도 길어서 일부 앞부분이 생략되었습니다.", "");
    }
    parts.push(list.map((m) => renderMessageBlock(m, settings)).join("\n\n"));
    parts.push("", `이제 ${targetLabel}의 입장에서 대화에 참여하세요.`);
    return parts.join("\n");
  });
}

function buildPrompt(target, room) {
  const cursor = Number(room.deliveryCursors?.[target] || 0);
  if (cursor <= 0) return buildInitialPrompt(target, room.messages, room.settings);
  return buildDeltaPrompt(target, room.messages, room.settings, cursor);
}

function resolveTargets(text, settings) {
  const lower = text.toLowerCase();
  const order = settings.speakingOrder.filter((service) => settings.services[service]?.enabled);
  if (/@all\b/i.test(text)) return order;
  const targets = [];
  if (/@(chatgpt|gpt)\b/i.test(lower)) targets.push("CHATGPT");
  if (/@claude\b/i.test(lower)) targets.push("CLAUDE");
  if (/@gemini\b/i.test(lower)) targets.push("GEMINI");
  if (targets.length) return order.filter((service) => targets.includes(service));
  return order;
}

async function ensureTab(service, opts = {}) {
  const settings = (await getRoom()).settings;
  const url = settings.services[service]?.url || SERVICE_URLS[service];
  const existing = await chrome.tabs.query({ url: SERVICE_URL_PATTERNS[service] });
  let tab = existing.find((item) => item.id && !item.discarded);
  if (!tab) tab = await chrome.tabs.create({ url, active: Boolean(opts.active) });
  else if (opts.active) await chrome.tabs.update(tab.id, { active: true, url: tab.url || url });
  if (!tab.id) throw new Error(`${SERVICE_LABELS[service]} 탭을 열 수 없습니다.`);
  if (opts.active && tab.windowId) await chrome.windows.update(tab.windowId, { focused: true });
  await waitForTab(tab.id);
  await injectContentScript(tab.id, service);
  return tab.id;
}

async function waitForTab(tabId) {
  for (let i = 0; i < 80; i += 1) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === "complete") return;
    await sleep(250);
  }
}

async function injectContentScript(tabId, service) {
  const tab = await chrome.tabs.get(tabId);
  const url = tab.url || "";
  if (!url.startsWith("https://")) {
    throw new Error(`${SERVICE_LABELS[service]} 탭 URL에 접근할 수 없습니다: ${url || "unknown"}`);
  }
  try {
    await chrome.tabs.sendMessage(tabId, { type: "PING", targetService: service });
    return;
  } catch {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content-script.js"] });
  }
  for (let i = 0; i < 10; i += 1) {
    try {
      await chrome.tabs.sendMessage(tabId, { type: "PING", targetService: service });
      return;
    } catch {
      await sleep(250);
    }
  }
  throw new Error(`${SERVICE_LABELS[service]} 탭에 확장 스크립트를 연결하지 못했습니다. 해당 탭을 새로고침하세요. url=${url}`);
}

async function sendToService(service, message) {
  const tabId = await ensureTab(service);
  return chrome.tabs.sendMessage(tabId, { ...message, targetService: service });
}

async function sendAndWaitForService(service, payload) {
  let started;
  try {
    started = await sendToService(service, { type: "START_SEND_JOB", ...payload });
  } catch (error) {
    const raw = error.message || String(error);
    if (/message channel closed|Receiving end does not exist|Extension context invalidated|asynchronous response/i.test(raw)) {
      throw new Error(`MESSAGE_CHANNEL_CLOSED:${raw}`);
    }
    throw error;
  }
  if (!started?.ok || !started.jobId) throw new Error(started?.error || "작업 시작 실패");

  const deadline = Date.now() + Number(payload.timeoutMs || DEFAULT_SETTINGS.responseTimeoutMs) + 10000;
  while (Date.now() < deadline) {
    if (abortRequested) throw new Error("ABORTED");
    await sleep(1000);
    let job;
    try {
      job = await sendToService(service, { type: "GET_SEND_JOB", jobId: started.jobId });
    } catch (error) {
      const raw = error.message || String(error);
      if (/message channel closed|Receiving end does not exist|Extension context invalidated|asynchronous response/i.test(raw)) {
        throw new Error(`MESSAGE_CHANNEL_CLOSED:${raw}`);
      }
      throw error;
    }
    if (!job?.ok) throw new Error(job?.error || "작업 상태 조회 실패");
    if (job.status === "DONE") return { ok: true, text: job.text };
    if (job.status === "ERROR") throw new Error(job.error || "응답 수집 실패");
  }
  throw new Error("RESPONSE_TIMEOUT");
}

async function openServiceForLogin(service) {
  return ensureTab(service, { active: true });
}

async function health() {
  const result = [];
  for (const service of SERVICES) {
    try {
      const tabId = await ensureTab(service);
      const response = await chrome.tabs.sendMessage(tabId, { type: "CHECK_LOGIN", targetService: service });
      result.push({ service, connected: true, loggedIn: Boolean(response?.loggedIn), url: response?.url || SERVICE_URLS[service] });
    } catch (error) {
      result.push({ service, connected: false, loggedIn: false, url: SERVICE_URLS[service], detail: error.message || String(error) });
    }
  }
  return result;
}

async function handleUserMessage(text) {
  const room = await getRoom();
  if (busy && !room.settings.allowSendWhileGenerating) throw new Error("이미 답변을 처리 중입니다.");
  busy = true;
  abortRequested = false;
  try {
    const round = Math.max(0, ...room.messages.map((m) => m.round || 0)) + 1;
    const userMsg = {
      id: id(),
      roomId: room.id,
      speaker: "USER",
      content: text,
      createdAt: now(),
      round,
      status: "COMPLETED",
    };
    room.messages.push(userMsg);
    emit({ type: "MESSAGE_ADDED", message: userMsg });
    await saveRoom(room);

    const enabled = room.settings.speakingOrder.filter((service) => room.settings.services[service]?.enabled);
    const queue = [...resolveTargets(text, room.settings)];
    const maxCascadeResponses = Math.max(1, Number(room.settings.maxCascadeResponses || DEFAULT_SETTINGS.maxCascadeResponses));
    let responseCount = 0;
    let exhausted = false;

    while (queue.length && responseCount < maxCascadeResponses) {
      if (abortRequested) break;
      const service = queue.shift();
      if (!room.settings.services[service]?.enabled || !hasUnreadFor(room, service)) continue;
      const completed = await runService(room, service, round);
      if (completed) {
        responseCount += 1;
        for (const next of enabled) {
          if (next !== service && hasUnreadFor(room, next) && !queue.includes(next)) queue.push(next);
        }
      }
      if (abortRequested) break;
      await sleep(room.settings.delayBetweenMs);
    }
    exhausted = queue.length > 0 && responseCount >= maxCascadeResponses;
    emit({ type: "ROUND_COMPLETED", round, exhausted, responseCount });
    if (exhausted) progress(`연쇄 답변이 ${maxCascadeResponses}개에 도달해서 자동으로 멈췄습니다.`);
  } finally {
    busy = false;
    await saveRoom(room);
  }
}

async function runService(room, service, round) {
  const aiMsg = {
    id: id(),
    roomId: room.id,
    speaker: service,
    content: "",
    createdAt: now(),
    round,
    status: "SENDING",
  };
  room.messages.push(aiMsg);
  emit({ type: "MESSAGE_ADDED", message: aiMsg });
  try {
    emit({ type: "SERVICE_STATUS_CHANGED", service, status: "SENDING" });
    const cursor = Number(room.deliveryCursors?.[service] || 0);
    const isInitialDelivery = cursor <= 0;
    progress(`${SERVICE_LABELS[service]}에 ${isInitialDelivery ? "초기 맥락" : "새로 추가된 대화"}를 전달하고 있습니다.`);
    const prompt = buildPrompt(service, room);
    markReadBy(room, service);
    await saveRoom(room);
    const responsePromise = sendAndWaitForService(service, {
      prompt,
      timeoutMs: room.settings.responseTimeoutMs,
      stabilizeMs: room.settings.stabilizeMs,
    });
    aiMsg.status = "STREAMING";
    emit({ type: "MESSAGE_ADDED", message: aiMsg });
    emit({ type: "SERVICE_STATUS_CHANGED", service, status: "GENERATING" });
    progress(`${SERVICE_LABELS[service]}의 답변을 기다리고 있습니다.`);
    const response = await responsePromise;
    if (abortRequested) throw new Error("ABORTED");
    if (!response?.ok) throw new Error(response?.error || "응답 수집 실패");
    aiMsg.content = response.text;
    aiMsg.status = "COMPLETED";
    room.deliveryCursors ||= Object.fromEntries(SERVICES.map((name) => [name, 0]));
    room.deliveryCursors[service] = room.messages.length;
    emit({ type: "SERVICE_STATUS_CHANGED", service, status: "DONE" });
    emit({ type: "RESPONSE_COMPLETED", service, message: aiMsg });
    progress(`${SERVICE_LABELS[service]} 답변을 수집했습니다. (${response.text.length}자)`);
    await saveRoom(room);
    return true;
  } catch (error) {
    const message = classifyError(service, error);
    aiMsg.status = "FAILED";
    aiMsg.errorMessage = message.detail;
    emit({ type: "SERVICE_STATUS_CHANGED", service, status: message.status });
    emit({ type: "RESPONSE_FAILED", service, error: message.detail });
    emit({ type: "MESSAGE_ADDED", message: aiMsg });
    await saveRoom(room);
    return false;
  }
}

function classifyError(service, error) {
  const raw = error.message || String(error);
  if (raw.includes("LOGIN_REQUIRED")) return { status: "LOGIN_REQUIRED", detail: `${SERVICE_LABELS[service]} 로그인이 필요합니다. 같은 Chrome에서 해당 서비스에 로그인하세요.` };
  if (raw.includes("ABORTED")) return { status: "PAUSED", detail: "사용자가 중단했습니다." };
  if (raw.includes("PROMPT_TOO_LONG")) {
    return {
      status: "ERROR",
      detail: `${SERVICE_LABELS[service]}가 입력 길이/토큰 한도 때문에 답변하지 못했습니다. 설정에서 최대 컨텍스트 메시지 수 또는 글자 수를 줄인 뒤 다시 시도하세요.`,
    };
  }
  if (raw.includes("MESSAGE_CHANNEL_CLOSED") || /message channel closed|asynchronous response/i.test(raw)) return { status: "ERROR", detail: `${SERVICE_LABELS[service]} 탭의 확장 메시지 채널이 중간에 닫혔습니다. 해당 서비스 탭을 새로고침한 뒤 다시 시도하세요.` };
  if (raw.includes("INPUT_NOT_FOUND")) return { status: "ERROR", detail: `${SERVICE_LABELS[service]} 입력창을 찾지 못했습니다. 서비스 화면을 새로고침하거나 선택자를 업데이트하세요.` };
  if (raw.includes("RESPONSE_NOT_STARTED")) return { status: "ERROR", detail: `${SERVICE_LABELS[service]}가 답변을 시작하지 못했습니다. 브라우저 탭에 사용량/토큰/메시지 한도 안내가 있는지 확인하세요.` };
  if (raw.includes("RESPONSE_TIMEOUT")) return { status: "ERROR", detail: `${SERVICE_LABELS[service]}의 답변 시간이 초과되었습니다.` };
  return { status: "ERROR", detail: raw };
}

async function retryService(service) {
  if (busy) throw new Error("처리 중에는 재시도할 수 없습니다.");
  const room = await getRoom();
  busy = true;
  abortRequested = false;
  try {
    const round = Math.max(1, ...room.messages.map((m) => m.round || 1));
    await runService(room, service, round);
  } finally {
    busy = false;
    await saveRoom(room);
  }
}

async function newChat(resetWeb) {
  const current = await getRoom();
  const room = createRoom(current.settings);
  await storageSet({ room });
  if (resetWeb) {
    for (const service of SERVICES) {
      if (room.settings.services[service].enabled) {
        await sendToService(service, { type: "START_NEW" }).catch(() => {});
      }
    }
  }
  emit({ type: "PROGRESS", text: "새 대화가 시작되었습니다." });
  return room;
}

async function updateSettings(patch) {
  const room = await getRoom();
  room.settings = normalizeSettings({
    ...room.settings,
    ...patch,
    services: patch.services || room.settings.services,
    personas: patch.personas || room.settings.personas,
    avatars: patch.avatars || room.settings.avatars,
    roles: patch.roles || room.settings.roles,
  });
  room.title = room.settings.roomTitle;
  room.mode = room.settings.defaultMode;
  await saveRoom(room);
  return room.settings;
}

async function exportRoom(format) {
  const room = await getRoom();
  if (format === "json") return JSON.stringify(room, null, 2);
  const lines = [`# ${room.title}`, "", `- 생성: ${room.createdAt}`, `- 수정: ${room.updatedAt}`, ""];
  for (const message of room.messages) {
    lines.push(`## ${speakerLabel(message.speaker, room.settings.userName)}`, "", message.content || message.errorMessage || "", "");
  }
  return lines.join("\n");
}

async function abort() {
  abortRequested = true;
  const room = await getRoom();
  for (const message of room.messages) {
    if ((message.status === "SENDING" || message.status === "STREAMING") && SERVICES.includes(message.speaker)) {
      message.status = "FAILED";
      message.errorMessage = "사용자가 중단했습니다.";
      emit({ type: "MESSAGE_ADDED", message });
      emit({ type: "SERVICE_STATUS_CHANGED", service: message.speaker, status: "PAUSED" });
    }
  }
  await saveRoom(room);
  for (const service of SERVICES) {
    const tabs = await chrome.tabs.query({ url: SERVICE_URL_PATTERNS[service] });
    for (const tab of tabs) {
      if (tab.id) {
        await chrome.tabs.sendMessage(tab.id, { type: "STOP", targetService: service }).catch(() => {});
      }
    }
  }
  busy = false;
  emit({ type: "ABORTED" });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.channel !== "roundtable-command") return false;
  (async () => {
    try {
      if (message.type === "GET_STATE") {
        const room = await getRoom();
        sendResponse({ ok: true, room, health: await health(), busy });
      } else if (message.type === "SEND_MESSAGE") {
        handleUserMessage(message.text).catch((error) => {
          progress(`전송 실패: ${error.message || String(error)}`);
          busy = false;
        });
        sendResponse({ ok: true });
      } else if (message.type === "CHECK_LOGIN") {
        sendResponse({ ok: true, health: await health() });
      } else if (message.type === "OPEN_TAB") {
        await openServiceForLogin(message.service);
        sendResponse({ ok: true });
      } else if (message.type === "OPEN_LOGIN_REQUIRED") {
        const statuses = await health();
        const needLogin = statuses.filter((item) => !item.loggedIn);
        for (const item of needLogin) await openServiceForLogin(item.service).catch(() => {});
        sendResponse({ ok: true, opened: needLogin.map((item) => item.service), health: statuses });
      } else if (message.type === "RETRY") {
        retryService(message.service).catch((error) => progress(`재시도 실패: ${error.message || String(error)}`));
        sendResponse({ ok: true });
      } else if (message.type === "ABORT") {
        await abort();
        sendResponse({ ok: true });
      } else if (message.type === "NEW_CHAT") {
        sendResponse({ ok: true, room: await newChat(Boolean(message.resetWeb)) });
      } else if (message.type === "GET_SETTINGS") {
        sendResponse({ ok: true, settings: (await getRoom()).settings });
      } else if (message.type === "UPDATE_SETTINGS") {
        sendResponse({ ok: true, settings: await updateSettings(message.settings || {}) });
      } else if (message.type === "RESET_ROLES") {
        sendResponse({ ok: true, settings: await updateSettings({ roles: structuredClone(DEFAULT_ROLES) }) });
      } else if (message.type === "DELETE_ALL") {
        const room = createRoom((await getRoom()).settings);
        await storageSet({ room });
        sendResponse({ ok: true, room });
      } else if (message.type === "EXPORT") {
        sendResponse({ ok: true, content: await exportRoom(message.format), filename: `roundtable_${Date.now()}.${message.format === "json" ? "json" : "md"}` });
      }
    } catch (error) {
      sendResponse({ ok: false, error: error.message || String(error) });
    }
  })();
  return true;
});
