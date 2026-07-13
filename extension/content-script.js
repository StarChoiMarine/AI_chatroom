(() => {
  if (window.__AI_ROUNDTABLE_CONTENT__) return;
  window.__AI_ROUNDTABLE_CONTENT__ = true;

  const SERVICE_BY_HOST = {
    "chatgpt.com": "CHATGPT",
    "claude.ai": "CLAUDE",
    "gemini.google.com": "GEMINI",
  };

  const SELECTORS = {
    CHATGPT: {
      loggedInIndicators: [
        "#prompt-textarea",
        'div[contenteditable="true"]#prompt-textarea',
        "textarea[data-id]",
        "form textarea",
      ],
      loginRequiredIndicators: [
        'button[data-testid="login-button"]',
        'a[href*="auth/login"]',
        "text=/Log in|로그인/i",
      ],
      input: [
        "#prompt-textarea",
        'div[contenteditable="true"]#prompt-textarea',
        "textarea[data-id]",
        "textarea[placeholder]",
        'div[contenteditable="true"]',
        "form textarea",
      ],
      sendButton: [
        'button[data-testid="send-button"]',
        'button[aria-label*="Send"]',
        'button[aria-label*="보내기"]',
        'form button[type="submit"]',
      ],
      stopButton: [
        'button[data-testid="stop-button"]',
        'button[aria-label*="Stop"]',
        'button[aria-label*="중지"]',
      ],
      assistantMessage: [
        'div[data-message-author-role="assistant"]',
        'div[data-testid^="conversation-turn"] div[data-message-author-role="assistant"]',
        ".markdown.prose",
      ],
      newChat: [
        'a[data-testid="create-new-chat-button"]',
        'a[href="/"]',
        'button[aria-label*="New chat"]',
      ],
    },
    CLAUDE: {
      loggedInIndicators: [
        'div[contenteditable="true"].ProseMirror',
        'div[contenteditable="true"]',
        'fieldset div[contenteditable="true"]',
      ],
      loginRequiredIndicators: [
        'input[name="email"]',
        "text=/Continue with Google|Log in|로그인|Sign in/i",
      ],
      input: [
        'div[contenteditable="true"].ProseMirror',
        'div[contenteditable="true"][translate="no"]',
        'div[contenteditable="true"]',
        "textarea",
      ],
      sendButton: [
        'button[aria-label*="Send"]',
        'button[aria-label*="보내기"]',
        'button[aria-label="Send message"]',
        'fieldset button[type="submit"]',
      ],
      stopButton: [
        'button[aria-label*="Stop"]',
        'button[aria-label*="중지"]',
      ],
      assistantMessage: [
        'div[data-testid="assistant-message"]',
        "div.font-claude-message",
        "div.font-claude-response",
      ],
      newChat: [
        'a[href="/new"]',
        'button[aria-label*="New chat"]',
      ],
    },
    GEMINI: {
      loggedInIndicators: [
        'div.ql-editor[contenteditable="true"]',
        'rich-textarea div[contenteditable="true"]',
        'div[contenteditable="true"]',
      ],
      loginRequiredIndicators: [
        'a[href*="accounts.google.com"]',
        "text=/Sign in|로그인/i",
      ],
      input: [
        'div.ql-editor[contenteditable="true"]',
        'rich-textarea div[contenteditable="true"]',
        'div[contenteditable="true"][role="textbox"]',
        'div[contenteditable="true"]',
        "textarea",
      ],
      sendButton: [
        'button[aria-label*="Send"]',
        'button[aria-label*="보내기"]',
        "button.send-button",
        'button[mattooltip*="Send"]',
      ],
      stopButton: [
        'button[aria-label*="Stop"]',
        'button[aria-label*="중지"]',
        "button.stop",
      ],
      assistantMessage: [
        "message-content.model-response-text",
        "div.model-response-text",
        "model-response .markdown",
        "message-content",
      ],
      newChat: [
        'button[aria-label*="New chat"]',
        'button[aria-label*="새 채팅"]',
      ],
    },
  };

  const service = SERVICE_BY_HOST[location.hostname];
  if (!service) return;

  let abortRequested = false;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const ERROR_PATTERNS = [
    /message is too long/i,
    /prompt is too long/i,
    /conversation is too long/i,
    /context window/i,
    /maximum length/i,
    /too many tokens/i,
    /exceeds? (the )?(maximum|limit)/i,
    /토큰.*(초과|한도)/i,
    /(너무|너무나) (깁니다|길어요)/i,
    /메시지가 너무 깁니다/i,
    /한도를 초과/i,
  ];

  function isVisible(el) {
    if (!el || !(el instanceof Element)) return false;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
  }

  function textMatcher(selector) {
    const match = selector.match(/^text=\/(.+)\/([a-z]*)$/i);
    if (!match) return null;
    return new RegExp(match[1], match[2]);
  }

  function query(selector) {
    const regex = textMatcher(selector);
    if (regex) {
      return [...document.querySelectorAll("button,a,input,textarea,div,span")]
        .filter((el) => isVisible(el) && regex.test(el.innerText || el.value || el.textContent || ""));
    }
    try {
      return [...document.querySelectorAll(selector)].filter(isVisible);
    } catch {
      return [];
    }
  }

  async function findFirst(candidates, timeoutEach = 1200) {
    for (const selector of candidates) {
      const deadline = Date.now() + timeoutEach;
      while (Date.now() < deadline) {
        const found = query(selector)[0];
        if (found) return found;
        await sleep(100);
      }
    }
    return null;
  }

  async function anyVisible(candidates, timeoutEach = 800) {
    return Boolean(await findFirst(candidates, timeoutEach));
  }

  async function checkLogin() {
    const selectors = SELECTORS[service];
    if (await anyVisible(selectors.loginRequiredIndicators, 500)) return false;
    return anyVisible(selectors.loggedInIndicators, 1200);
  }

  function throwIfAborted() {
    if (abortRequested) throw new Error("ABORTED");
  }

  function readVisibleErrorText() {
    const candidates = [
      '[role="alert"]',
      '[data-testid*="error"]',
      '.error',
      '.text-danger',
      '.text-red-500',
      '.text-red-600',
      'div[class*="error"]',
      'div[class*="danger"]',
      'div[class*="warning"]',
    ];
    const texts = [];
    for (const selector of candidates) {
      for (const el of query(selector)) {
        const text = (el.innerText || el.textContent || "").trim();
        if (text) texts.push(text);
      }
    }
    const bodyText = (document.body.innerText || "").slice(-12000);
    texts.push(bodyText);
    return texts.find((text) => ERROR_PATTERNS.some((pattern) => pattern.test(text))) || "";
  }

  function throwIfPageError() {
    const text = readVisibleErrorText();
    if (!text) return;
    const compact = text.replace(/\s+/g, " ").trim().slice(0, 400);
    throw new Error(`PROMPT_TOO_LONG:${compact}`);
  }

  function setNativeValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
    descriptor?.set?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function typeMessage(input, message) {
    throwIfAborted();
    input.focus();
    input.click();
    if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
      setNativeValue(input, message);
      return;
    }
    input.textContent = "";
    document.execCommand("insertText", false, message);
    input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: message }));
  }

  async function submit(input) {
    const selectors = SELECTORS[service];
    const deadline = Date.now() + 5000;
    let sawDisabledSendButton = false;
    while (Date.now() < deadline) {
      throwIfAborted();
      throwIfPageError();
      const button = await findFirst(selectors.sendButton, 300);
      if (button && !button.disabled && button.getAttribute("aria-disabled") !== "true") {
        button.click();
        return;
      }
      if (button) sawDisabledSendButton = true;
      await sleep(150);
    }
    if (sawDisabledSendButton) {
      throw new Error("PROMPT_TOO_LONG:send button stayed disabled");
    }
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
  }

  function countAssistantMessages() {
    const selectors = SELECTORS[service];
    for (const selector of selectors.assistantMessage) {
      const items = query(selector);
      if (items.length) return items.length;
    }
    return 0;
  }

  function readLatestAssistantText() {
    const selectors = SELECTORS[service];
    for (const selector of selectors.assistantMessage) {
      const items = query(selector);
      if (items.length) {
        const text = (items[items.length - 1].innerText || items[items.length - 1].textContent || "").trim();
        if (text) return text;
      }
    }
    return "";
  }

  async function isGenerating() {
    return anyVisible(SELECTORS[service].stopButton, 200);
  }

  async function waitForStableText({ baselineCount, timeoutMs, stabilizeMs }) {
    const startDeadline = Date.now() + 30000;
    while (Date.now() < startDeadline) {
      throwIfAborted();
      throwIfPageError();
      if (countAssistantMessages() > baselineCount || await isGenerating()) break;
      await sleep(400);
    }

    const deadline = Date.now() + timeoutMs;
    let lastText = "";
    let stableSince = Date.now();
    while (Date.now() < deadline) {
      throwIfAborted();
      throwIfPageError();
      const text = readLatestAssistantText();
      const generating = await isGenerating();
      if (text !== lastText) {
        lastText = text;
        stableSince = Date.now();
      }
      if (lastText && !generating && Date.now() - stableSince >= stabilizeMs) {
        return lastText;
      }
      await sleep(500);
    }
    return lastText;
  }

  async function sendAndWait({ prompt, timeoutMs, stabilizeMs }) {
    abortRequested = false;
    if (!(await checkLogin())) {
      throw new Error("LOGIN_REQUIRED");
    }
    const selectors = SELECTORS[service];
    const baselineCount = countAssistantMessages();
    const input = await findFirst(selectors.input, 2500);
    if (!input) throw new Error("INPUT_NOT_FOUND");
    await typeMessage(input, prompt);
    throwIfPageError();
    await submit(input);
    throwIfPageError();
    const text = await waitForStableText({ baselineCount, timeoutMs, stabilizeMs });
    if (!text) throw new Error("RESPONSE_TIMEOUT");
    return text;
  }

  async function startNewConversation() {
    const button = await findFirst(SELECTORS[service].newChat, 1200);
    if (button) {
      button.click();
      await sleep(1000);
      return true;
    }
    location.href = service === "CLAUDE" ? "https://claude.ai/new" : service === "GEMINI" ? "https://gemini.google.com/app" : "https://chatgpt.com/";
    return true;
  }

  async function stopGeneration() {
    abortRequested = true;
    const button = await findFirst(SELECTORS[service].stopButton, 500);
    if (button) button.click();
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.targetService !== service) return false;
    (async () => {
      try {
        if (message.type === "PING") sendResponse({ ok: true, service });
        else if (message.type === "CHECK_LOGIN") sendResponse({ ok: true, loggedIn: await checkLogin(), service, url: location.href });
        else if (message.type === "SEND_AND_WAIT") sendResponse({ ok: true, text: await sendAndWait(message) });
        else if (message.type === "START_NEW") sendResponse({ ok: true, started: await startNewConversation() });
        else if (message.type === "STOP") sendResponse({ ok: true, stopped: await stopGeneration() });
      } catch (error) {
        sendResponse({ ok: false, error: error.message || String(error), service });
      }
    })();
    return true;
  });
})();
