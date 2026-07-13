/* AI 원탁회의 프론트엔드 */
const $ = (s) => document.querySelector(s);
const SERVICE_LABELS = { CHATGPT: "ChatGPT", CLAUDE: "Claude", GEMINI: "Gemini", USER: "사용자", SYSTEM: "시스템" };
const STATUS_TEXT = {
  READY: "준비됨", LOGIN_REQUIRED: "로그인 필요", SENDING: "메시지 전송 중",
  GENERATING: "답변 작성 중", DONE: "답변 완료", PAUSED: "일시 정지",
  ERROR: "오류 발생", DISCONNECTED: "연결 끊김",
};

const state = {
  settings: null,
  messages: [],          // 순서 유지 배열
  msgIndex: new Map(),    // id -> message
  busy: false,
  userName: "사용자",
};

marked.setOptions({ breaks: true, gfm: true });
function renderMarkdown(text) {
  const raw = marked.parse(text || "");
  return DOMPurify.sanitize(raw);
}

/* ---------- 초기 로드 ---------- */
async function loadState() {
  const r = await fetch("/api/state").then((x) => x.json());
  state.settings = r.room.settings;
  state.userName = r.room.settings.userName || "사용자";
  state.busy = r.busy;
  $("#roomTitle").textContent = r.room.title;
  $("#modeLabel").textContent = r.room.mode === "ROUNDTABLE" ? "원탁회의" : "자유 토론";
  state.messages = [];
  state.msgIndex.clear();
  r.room.messages.forEach(upsertMessage);
  renderAllMessages();
  applyHealth(r.health);
  updateSendState();
}

/* ---------- 메시지 ---------- */
function upsertMessage(msg) {
  if (state.msgIndex.has(msg.id)) {
    const existing = state.msgIndex.get(msg.id);
    Object.assign(existing, msg);
  } else {
    state.msgIndex.set(msg.id, msg);
    state.messages.push(msg);
  }
}

function renderAllMessages() {
  const box = $("#messages");
  box.innerHTML = "";
  state.messages.forEach((m) => box.appendChild(renderMessage(m)));
  box.scrollTop = box.scrollHeight;
}

function renderMessage(m) {
  const wrap = document.createElement("div");
  wrap.className = `msg ${m.speaker}`;
  wrap.dataset.id = m.id;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = m.speaker === "USER" ? "나" : (SERVICE_LABELS[m.speaker] || "S")[0];

  const bubble = document.createElement("div");
  bubble.className = `bubble ${m.speaker}`;

  const meta = document.createElement("div");
  meta.className = "meta";
  const who = document.createElement("span");
  who.className = "who";
  who.textContent = m.speaker === "USER" ? state.userName : (SERVICE_LABELS[m.speaker] || m.speaker);
  meta.appendChild(who);
  const time = document.createElement("span");
  time.textContent = new Date(m.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  meta.appendChild(time);
  if (m.status && !["COMPLETED"].includes(m.status) && m.speaker !== "USER") {
    const chip = document.createElement("span");
    chip.className = `status-chip ${m.status}`;
    chip.textContent = m.status === "SENDING" ? "전송 중" : m.status === "STREAMING" ? "작성 중" : m.status === "FAILED" ? "실패" : m.status;
    meta.appendChild(chip);
  }
  bubble.appendChild(meta);

  const body = document.createElement("div");
  body.className = "body";
  if (m.speaker === "USER") {
    body.textContent = m.content;
  } else if (m.status === "FAILED") {
    body.innerHTML = `<div class="err-text">${escapeHtml(m.errorMessage || "오류가 발생했습니다.")}</div>`;
    body.appendChild(buildErrorActions(m));
  } else if (!m.content && (m.status === "SENDING" || m.status === "STREAMING")) {
    body.innerHTML = `<span class="typing"><span></span><span></span><span></span></span>`;
  } else {
    body.innerHTML = renderMarkdown(m.content);
  }
  bubble.appendChild(body);

  wrap.appendChild(avatar);
  wrap.appendChild(bubble);
  return wrap;
}

function buildErrorActions(m) {
  const div = document.createElement("div");
  div.className = "err-actions";
  const retry = document.createElement("button");
  retry.textContent = `${SERVICE_LABELS[m.speaker]} 다시 시도`;
  retry.onclick = () => api("/api/retry", { service: m.speaker });
  const reLogin = document.createElement("button");
  reLogin.textContent = "로그인 상태 확인";
  reLogin.onclick = () => checkLogin(m.speaker);
  const openTab = document.createElement("button");
  openTab.textContent = "탭 열기";
  openTab.onclick = () => api("/api/open-tab", { service: m.speaker });
  div.appendChild(retry);
  div.appendChild(reLogin);
  div.appendChild(openTab);
  return div;
}

function patchMessage(m) {
  const el = $(`.msg[data-id="${m.id}"]`);
  if (!el) {
    $("#messages").appendChild(renderMessage(m));
  } else {
    el.replaceWith(renderMessage(m));
  }
  const box = $("#messages");
  box.scrollTop = box.scrollHeight;
}

/* ---------- 참가자 상태 ---------- */
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
  (health || []).forEach((h) => {
    if (!h.connected) setParticipantStatus(h.service, "DISCONNECTED");
    else setParticipantStatus(h.service, h.loggedIn ? "READY" : "LOGIN_REQUIRED");
  });
}

/* ---------- 진행 로그 ---------- */
function addProgress(text) {
  const log = $("#progressLog");
  const div = document.createElement("div");
  div.textContent = text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
  while (log.children.length > 60) log.removeChild(log.firstChild);
}

/* ---------- 소켓 ---------- */
const socket = io();
socket.on("orchestrator", (ev) => {
  switch (ev.type) {
    case "SERVICE_STATUS_CHANGED": setParticipantStatus(ev.service, ev.status); break;
    case "MESSAGE_ADDED": upsertMessage(ev.message); patchMessage(ev.message); break;
    case "PROGRESS": addProgress(ev.text); break;
    case "RESPONSE_FAILED": addProgress(`⚠️ ${ev.service}: ${ev.error}`); break;
    case "RESPONSE_COMPLETED": upsertMessage(ev.message); patchMessage(ev.message); break;
    case "ROUND_COMPLETED":
      state.busy = false; updateSendState();
      addProgress(`라운드 ${ev.round} 완료.`);
      break;
    case "ABORTED":
      state.busy = false; updateSendState();
      addProgress("⏹ 대화가 중단되었습니다.");
      break;
  }
});

/* ---------- 전송 ---------- */
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
  const res = await fetch("/api/message", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    addProgress(`전송 실패: ${e.error || res.status}`);
    state.busy = false; updateSendState();
  }
}

async function api(path, body) {
  const res = await fetch(path, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  return res.json().catch(() => ({}));
}

async function checkLogin(service) {
  addProgress(`${service ? SERVICE_LABELS[service] : "전체"} 로그인 상태 확인 중...`);
  const r = await api("/api/check-login", service ? { service } : {});
  Object.entries(r.result || {}).forEach(([s, ok]) => {
    setParticipantStatus(s, ok ? "READY" : "LOGIN_REQUIRED");
    addProgress(`${SERVICE_LABELS[s]}: ${ok ? "로그인됨" : "로그인 필요"}`);
  });
}

/* ---------- 이벤트 바인딩 ---------- */
$("#btnSend").onclick = sendMessage;
$("#input").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
$("#input").addEventListener("input", (e) => {
  e.target.style.height = "auto";
  e.target.style.height = Math.min(e.target.scrollHeight, 180) + "px";
});
$("#btnAbort").onclick = async () => { await api("/api/abort"); };
$("#btnCheckLogin").onclick = () => checkLogin(null);

/* 새 대화 모달 */
$("#btnNewChat").onclick = () => $("#newChatModal").classList.remove("hidden");
$("#btnNewCancel").onclick = () => $("#newChatModal").classList.add("hidden");
$("#btnNewLocal").onclick = async () => { await api("/api/new-chat", { resetWeb: false }); $("#newChatModal").classList.add("hidden"); await loadState(); };
$("#btnNewWeb").onclick = async () => { await api("/api/new-chat", { resetWeb: true }); $("#newChatModal").classList.add("hidden"); await loadState(); };

/* 내보내기 */
$("#btnExportMd").onclick = () => window.open("/api/export/markdown", "_blank");
$("#btnExportJson").onclick = () => window.open("/api/export/json", "_blank");

/* ---------- 설정 모달 ---------- */
$("#btnSettings").onclick = () => { renderSettings(); $("#settingsModal").classList.remove("hidden"); };
$("#btnCloseSettings").onclick = () => $("#settingsModal").classList.add("hidden");
$("#btnResetRoles").onclick = async () => { const r = await api("/api/settings/reset-roles"); state.settings = r.settings; renderSettings(); };
$("#btnSaveSettings").onclick = saveSettings;

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
      <div><label>대화방 이름</label><input type="text" id="roomTitle" value="${escapeAttr(s.roomTitle)}"/></div>
    </div>
    <div class="field inline">
      <div><label>기본 모드</label><select id="defaultMode">
        <option value="ROUNDTABLE" ${s.defaultMode === "ROUNDTABLE" ? "selected" : ""}>원탁회의</option>
        <option value="FREE_DEBATE" ${s.defaultMode === "FREE_DEBATE" ? "selected" : ""}>자유 토론(2차)</option>
      </select></div>
      <div><label>발언 순서 (쉼표)</label><input type="text" id="speakingOrder" value="${s.speakingOrder.join(",")}"/></div>
    </div>
    <div class="field inline">
      <div><label>최대 컨텍스트 메시지 수</label><input type="number" id="maxContextMessages" value="${s.maxContextMessages}"/></div>
      <div><label>최대 컨텍스트 글자 수</label><input type="number" id="maxContextChars" value="${s.maxContextChars}"/></div>
    </div>
    <div class="field inline">
      <div><label>답변 제한 시간(ms)</label><input type="number" id="responseTimeoutMs" value="${s.responseTimeoutMs}"/></div>
      <div><label>안정화 시간(ms)</label><input type="number" id="stabilizeMs" value="${s.stabilizeMs}"/></div>
    </div>
    <div class="field inline">
      <div><label>답변 사이 대기(ms)</label><input type="number" id="delayBetweenMs" value="${s.delayBetweenMs}"/></div>
      <div class="checkbox" style="align-self:end"><input type="checkbox" id="allowSendWhileGenerating" ${s.allowSendWhileGenerating ? "checked" : ""}/><label for="allowSendWhileGenerating">답변 도중 새 메시지 허용</label></div>
    </div>
    <div class="field row"><input type="checkbox" id="saveScreenshots" ${s.saveScreenshots ? "checked" : ""}/><label for="saveScreenshots">오류 시 디버깅 스크린샷 저장</label></div>

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
    if (confirm("저장된 모든 대화를 삭제할까요?")) { await api("/api/rooms/delete-all"); addProgress("모든 대화 삭제됨."); }
  };
}

async function saveSettings() {
  const s = state.settings;
  const num = (id, d) => { const v = Number($("#" + id).value); return Number.isFinite(v) ? v : d; };
  const patch = {
    userName: $("#userName").value || "사용자",
    roomTitle: $("#roomTitle").value || "AI 원탁회의",
    defaultMode: $("#defaultMode").value,
    speakingOrder: $("#speakingOrder").value.split(",").map((x) => x.trim().toUpperCase()).filter(Boolean),
    maxContextMessages: num("maxContextMessages", s.maxContextMessages),
    maxContextChars: num("maxContextChars", s.maxContextChars),
    responseTimeoutMs: num("responseTimeoutMs", s.responseTimeoutMs),
    stabilizeMs: num("stabilizeMs", s.stabilizeMs),
    delayBetweenMs: num("delayBetweenMs", s.delayBetweenMs),
    allowSendWhileGenerating: $("#allowSendWhileGenerating").checked,
    saveScreenshots: $("#saveScreenshots").checked,
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
  const r = await api("/api/settings", { settings: patch });
  state.settings = r.settings;
  state.userName = r.settings.userName;
  $("#roomTitle").textContent = r.settings.roomTitle;
  $("#modeLabel").textContent = r.settings.defaultMode === "ROUNDTABLE" ? "원탁회의" : "자유 토론";
  $("#settingsModal").classList.add("hidden");
  updateSendState();
  addProgress("설정이 저장되었습니다.");
}

/* ---------- 유틸 ---------- */
function escapeHtml(s) { return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }
function escapeAttr(s) { return String(s).replace(/"/g, "&quot;"); }

loadState();
