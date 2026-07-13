const $ = (selector) => document.querySelector(selector);
const SERVICE_LABELS = { CHATGPT: "ChatGPT", CLAUDE: "Claude", GEMINI: "Gemini", USER: "사용자", SYSTEM: "시스템" };
const STATUS_TEXT = {
  READY: "준비됨",
  LOGIN_REQUIRED: "로그인 필요",
  SENDING: "메시지 전송 중",
  GENERATING: "답변 작성 중",
  DONE: "답변 완료",
  PAUSED: "일시 정지",
  ERROR: "오류 발생",
  DISCONNECTED: "연결 끊김",
};

const state = {
  settings: null,
  messages: [],
  msgIndex: new Map(),
  busy: false,
  userName: "사용자",
};

function command(type, body = {}) {
  return chrome.runtime.sendMessage({ channel: "roundtable-command", type, ...body });
}

async function loadState() {
  const response = await command("GET_STATE");
  if (!response?.ok) throw new Error(response?.error || "상태를 불러오지 못했습니다.");
  state.settings = response.room.settings;
  state.userName = response.room.settings.userName || "사용자";
  state.busy = response.busy;
  $("#roomTitle").textContent = response.room.title;
  $("#modeLabel").textContent = response.room.mode === "ROUNDTABLE" ? "원탁회의" : "자유 토론";
  state.messages = [];
  state.msgIndex.clear();
  response.room.messages.forEach(upsertMessage);
  renderAllMessages();
  applyHealth(response.health);
  updateSendState();
}

function upsertMessage(message) {
  if (state.msgIndex.has(message.id)) {
    Object.assign(state.msgIndex.get(message.id), message);
  } else {
    state.msgIndex.set(message.id, message);
    state.messages.push(message);
  }
}

function renderAllMessages() {
  const box = $("#messages");
  box.innerHTML = "";
  state.messages.forEach((message) => box.appendChild(renderMessage(message)));
  box.scrollTop = box.scrollHeight;
}

function renderMessage(message) {
  const wrap = document.createElement("div");
  wrap.className = `msg ${message.speaker}`;
  wrap.dataset.id = message.id;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = message.speaker === "USER" ? "나" : (SERVICE_LABELS[message.speaker] || "S")[0];

  const bubble = document.createElement("div");
  bubble.className = `bubble ${message.speaker}`;

  const meta = document.createElement("div");
  meta.className = "meta";
  const who = document.createElement("span");
  who.className = "who";
  who.textContent = message.speaker === "USER" ? state.userName : (SERVICE_LABELS[message.speaker] || message.speaker);
  meta.appendChild(who);
  const time = document.createElement("span");
  time.textContent = new Date(message.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  meta.appendChild(time);
  if (message.status && !["COMPLETED"].includes(message.status) && message.speaker !== "USER") {
    const chip = document.createElement("span");
    chip.className = `status-chip ${message.status}`;
    chip.textContent = message.status === "SENDING" ? "전송 중" : message.status === "STREAMING" ? "작성 중" : message.status === "FAILED" ? "실패" : message.status;
    meta.appendChild(chip);
  }
  bubble.appendChild(meta);

  const body = document.createElement("div");
  body.className = "body";
  if (message.status === "FAILED") {
    const error = document.createElement("div");
    error.className = "err-text";
    error.textContent = message.errorMessage || "오류가 발생했습니다.";
    body.appendChild(error);
    body.appendChild(buildErrorActions(message));
  } else if (!message.content && message.status === "SENDING") {
    body.innerHTML = '<span class="typing"><span></span><span></span><span></span></span>';
  } else {
    body.textContent = message.content || "";
  }
  bubble.appendChild(body);
  wrap.appendChild(avatar);
  wrap.appendChild(bubble);
  return wrap;
}

function buildErrorActions(message) {
  const div = document.createElement("div");
  div.className = "err-actions";
  const retry = document.createElement("button");
  retry.textContent = `${SERVICE_LABELS[message.speaker]} 다시 시도`;
  retry.onclick = () => command("RETRY", { service: message.speaker });
  const reLogin = document.createElement("button");
  reLogin.textContent = "로그인 상태 확인";
  reLogin.onclick = () => checkLogin();
  const openTab = document.createElement("button");
  openTab.textContent = "탭 열기";
  openTab.onclick = () => command("OPEN_TAB", { service: message.speaker });
  div.append(retry, reLogin, openTab);
  return div;
}

function patchMessage(message) {
  const el = $(`.msg[data-id="${message.id}"]`);
  if (!el) $("#messages").appendChild(renderMessage(message));
  else el.replaceWith(renderMessage(message));
  const box = $("#messages");
  box.scrollTop = box.scrollHeight;
}

function setParticipantStatus(service, status) {
  const li = $(`#participants li[data-service="${service}"]`);
  if (!li) return;
  const dot = li.querySelector(".dot");
  const st = li.querySelector(".pstatus");
  st.textContent = STATUS_TEXT[status] || status;
  dot.className = "dot";
  if (status === "READY" || status === "DONE") dot.classList.add("on");
  else if (status === "SENDING" || status === "GENERATING") dot.classList.add("warn");
  else if (status === "ERROR" || status === "LOGIN_REQUIRED" || status === "DISCONNECTED") dot.classList.add("err");
  document.querySelectorAll("#participants li").forEach((x) => x.classList.remove("speaking"));
  if (status === "GENERATING" || status === "SENDING") li.classList.add("speaking");
}

function applyHealth(health) {
  (health || []).forEach((item) => {
    if (!item.connected) setParticipantStatus(item.service, "DISCONNECTED");
    else setParticipantStatus(item.service, item.loggedIn ? "READY" : "LOGIN_REQUIRED");
  });
}

function addProgress(text) {
  const log = $("#progressLog");
  const div = document.createElement("div");
  div.textContent = text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
  while (log.children.length > 60) log.removeChild(log.firstChild);
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.channel !== "roundtable-event") return;
  const ev = message.event;
  if (ev.type === "SERVICE_STATUS_CHANGED") setParticipantStatus(ev.service, ev.status);
  else if (ev.type === "MESSAGE_ADDED") {
    upsertMessage(ev.message);
    patchMessage(ev.message);
  } else if (ev.type === "PROGRESS") addProgress(ev.text);
  else if (ev.type === "RESPONSE_FAILED") addProgress(`${SERVICE_LABELS[ev.service]}: ${ev.error}`);
  else if (ev.type === "RESPONSE_COMPLETED") {
    upsertMessage(ev.message);
    patchMessage(ev.message);
  } else if (ev.type === "ROUND_COMPLETED") {
    state.busy = false;
    updateSendState();
    addProgress(`라운드 ${ev.round} 완료.`);
  } else if (ev.type === "ABORTED") {
    state.busy = false;
    updateSendState();
    addProgress("대화가 중단되었습니다.");
  }
});

function updateSendState() {
  const allow = state.settings?.allowSendWhileGenerating;
  $("#btnSend").disabled = state.busy && !allow;
  $("#btnAbort").disabled = !state.busy;
}

async function sendMessage() {
  const input = $("#input");
  const text = input.value.trim();
  if (!text) return;
  if (state.busy && !state.settings?.allowSendWhileGenerating) return;
  input.value = "";
  state.busy = true;
  updateSendState();
  const response = await command("SEND_MESSAGE", { text });
  if (!response?.ok) {
    addProgress(`전송 실패: ${response?.error || "unknown"}`);
    state.busy = false;
    updateSendState();
  }
}

async function checkLogin() {
  addProgress("로그인 상태 확인 중...");
  const response = await command("CHECK_LOGIN");
  if (response?.ok) applyHealth(response.health);
}

function renderSettings() {
  const s = state.settings;
  const body = $("#settingsBody");
  const svc = (id, label) => `
    <div class="field inline">
      <div class="checkbox"><input type="checkbox" id="en_${id}" ${s.services[id].enabled ? "checked" : ""}/><label for="en_${id}">${label} 사용</label></div>
      <div><input type="text" id="url_${id}" value="${escapeAttr(s.services[id].url)}"/></div>
    </div>`;
  body.innerHTML = `
    <div class="section-title">서비스</div>
    ${svc("CHATGPT", "ChatGPT")}${svc("CLAUDE", "Claude")}${svc("GEMINI", "Gemini")}
    <div class="section-title">대화 설정</div>
    <div class="field inline">
      <div><label>사용자 이름</label><input type="text" id="userName" value="${escapeAttr(s.userName)}"/></div>
      <div><label>대화방 이름</label><input type="text" id="roomTitleInput" value="${escapeAttr(s.roomTitle)}"/></div>
    </div>
    <div class="field inline">
      <div><label>발언 순서</label><input type="text" id="speakingOrder" value="${s.speakingOrder.join(",")}"/></div>
      <div><label>답변 제한 시간(ms)</label><input type="number" id="responseTimeoutMs" value="${s.responseTimeoutMs}"/></div>
    </div>
    <div class="field inline">
      <div><label>최대 컨텍스트 메시지 수</label><input type="number" id="maxContextMessages" value="${s.maxContextMessages}"/></div>
      <div><label>최대 컨텍스트 글자 수</label><input type="number" id="maxContextChars" value="${s.maxContextChars}"/></div>
    </div>
    <div class="field inline">
      <div><label>안정화 시간(ms)</label><input type="number" id="stabilizeMs" value="${s.stabilizeMs}"/></div>
      <div><label>답변 사이 대기(ms)</label><input type="number" id="delayBetweenMs" value="${s.delayBetweenMs}"/></div>
    </div>
    <div class="section-title">역할 프롬프트</div>
    <div class="field"><label>공통 대화 규칙</label><textarea id="role_common">${escapeHtml(s.roles.commonRules)}</textarea></div>
    <div class="field"><label>ChatGPT 역할</label><textarea id="role_chatgpt">${escapeHtml(s.roles.chatgpt)}</textarea></div>
    <div class="field"><label>Claude 역할</label><textarea id="role_claude">${escapeHtml(s.roles.claude)}</textarea></div>
    <div class="field"><label>Gemini 역할</label><textarea id="role_gemini">${escapeHtml(s.roles.gemini)}</textarea></div>
    <div class="section-title">저장</div>
    <div class="field row"><input type="checkbox" id="autoSave" ${s.autoSave ? "checked" : ""}/><label for="autoSave">대화 자동 저장</label></div>
    <div class="field"><button class="danger" id="btnDeleteAll" type="button">전체 대화 삭제</button></div>
  `;
  $("#btnDeleteAll").onclick = async () => {
    if (confirm("저장된 모든 대화를 삭제할까요?")) {
      await command("DELETE_ALL");
      await loadState();
      addProgress("모든 대화 삭제됨.");
    }
  };
}

async function saveSettings() {
  const s = state.settings;
  const num = (id, fallback) => {
    const value = Number($("#" + id).value);
    return Number.isFinite(value) ? value : fallback;
  };
  const patch = {
    userName: $("#userName").value || "사용자",
    roomTitle: $("#roomTitleInput").value || "AI 원탁회의",
    speakingOrder: $("#speakingOrder").value.split(",").map((x) => x.trim().toUpperCase()).filter(Boolean),
    maxContextMessages: num("maxContextMessages", s.maxContextMessages),
    maxContextChars: num("maxContextChars", s.maxContextChars),
    responseTimeoutMs: num("responseTimeoutMs", s.responseTimeoutMs),
    stabilizeMs: num("stabilizeMs", s.stabilizeMs),
    delayBetweenMs: num("delayBetweenMs", s.delayBetweenMs),
    autoSave: $("#autoSave").checked,
    services: {
      CHATGPT: { enabled: $("#en_CHATGPT").checked, url: $("#url_CHATGPT").value },
      CLAUDE: { enabled: $("#en_CLAUDE").checked, url: $("#url_CLAUDE").value },
      GEMINI: { enabled: $("#en_GEMINI").checked, url: $("#url_GEMINI").value },
    },
    roles: {
      commonRules: $("#role_common").value,
      chatgpt: $("#role_chatgpt").value,
      claude: $("#role_claude").value,
      gemini: $("#role_gemini").value,
    },
  };
  const response = await command("UPDATE_SETTINGS", { settings: patch });
  if (response?.ok) {
    state.settings = response.settings;
    state.userName = response.settings.userName;
    $("#roomTitle").textContent = response.settings.roomTitle;
    $("#settingsModal").classList.add("hidden");
    addProgress("설정이 저장되었습니다.");
  }
}

async function downloadExport(format) {
  const response = await command("EXPORT", { format });
  if (!response?.ok) return;
  const blob = new Blob([response.content], { type: format === "json" ? "application/json" : "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = response.filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

function escapeAttr(s) {
  return String(s).replace(/"/g, "&quot;");
}

$("#btnSend").onclick = sendMessage;
$("#input").addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});
$("#input").addEventListener("input", (event) => {
  event.target.style.height = "auto";
  event.target.style.height = Math.min(event.target.scrollHeight, 180) + "px";
});
$("#btnAbort").onclick = () => command("ABORT");
$("#btnCheckLogin").onclick = checkLogin;
$("#btnNewChat").onclick = () => $("#newChatModal").classList.remove("hidden");
$("#btnNewCancel").onclick = () => $("#newChatModal").classList.add("hidden");
$("#btnNewLocal").onclick = async () => {
  await command("NEW_CHAT", { resetWeb: false });
  $("#newChatModal").classList.add("hidden");
  await loadState();
};
$("#btnNewWeb").onclick = async () => {
  await command("NEW_CHAT", { resetWeb: true });
  $("#newChatModal").classList.add("hidden");
  await loadState();
};
$("#btnSettings").onclick = () => {
  renderSettings();
  $("#settingsModal").classList.remove("hidden");
};
$("#btnCloseSettings").onclick = () => $("#settingsModal").classList.add("hidden");
$("#btnSaveSettings").onclick = saveSettings;
$("#btnResetRoles").onclick = async () => {
  const response = await command("RESET_ROLES");
  if (response?.ok) {
    state.settings = response.settings;
    renderSettings();
  }
};
$("#btnExportMd").onclick = () => downloadExport("md");
$("#btnExportJson").onclick = () => downloadExport("json");

loadState().catch((error) => addProgress(error.message || String(error)));
