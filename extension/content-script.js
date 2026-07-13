(() => {
  const CONTENT_VERSION = "2026-07-14-gemini-response-scope";
  if (window.__AI_ROUNDTABLE_CONTENT__ === CONTENT_VERSION) return;
  window.__AI_ROUNDTABLE_CONTENT__ = CONTENT_VERSION;

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
      continueButton: [
        'button:has-text("Continue generating")',
        "text=/^Continue generating$|^계속 생성$/i",
        'button[aria-label*="Continue"]',
        'button[aria-label*="계속"]',
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
      continueButton: [
        "text=/^Continue$|^계속$/i",
      ],
      assistantMessage: [
        'div[data-testid="assistant-message"]',
        '[data-testid="conversation-turn"] div[data-is-streaming="false"]',
        '[data-testid="conversation-turn"] div[class*="font-claude"]',
        "div.font-claude-message",
        "div.font-claude-response",
        'div[class*="font-claude-message"]',
        'div[class*="claude-response"]',
        'article div[class*="prose"]',
        'article div[class*="markdown"]',
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
        'rich-textarea [contenteditable="true"]',
        'rich-textarea',
        'bard-sidenav',
        'side-navigation',
        'button[aria-label*="New chat"]',
        'button[aria-label*="새 채팅"]',
        'button[aria-label*="Send"]',
        'button[aria-label*="보내기"]',
        'div[contenteditable="true"]',
      ],
      loginRequiredIndicators: [
        'a[href*="accounts.google.com"]',
        "text=/^Sign in$|^로그인$/i",
      ],
      input: [
        'div.ql-editor[contenteditable="true"]',
        'rich-textarea .ql-editor[contenteditable="true"]',
        'rich-textarea div[contenteditable="true"]',
        'rich-textarea [contenteditable="true"]',
        'div[aria-label*="Enter a prompt"]',
        'div[aria-label*="프롬프트"]',
        'div[data-placeholder]',
        'div[contenteditable="true"][role="textbox"]',
        'div[contenteditable="true"]',
        "textarea",
      ],
      sendButton: [
        'button[aria-label*="Send message"]',
        'button[aria-label*="Send"]',
        'button[aria-label*="Submit"]',
        'button[aria-label*="전송"]',
        'button[aria-label*="메시지 보내기"]',
        'button[aria-label*="보내기"]',
        "button.send-button",
        "button[send-button]",
        'button[mattooltip*="Send"]',
      ],
      stopButton: [
        'button[aria-label*="Stop"]',
        'button[aria-label*="중지"]',
        "button.stop",
      ],
      continueButton: [
        "text=/^Continue$|^계속$/i",
      ],
      assistantMessage: [
        "message-content.model-response-text",
        "div.model-response-text",
        "model-response message-content",
        "model-response .markdown",
        "model-response div[class*='markdown']",
        "model-response div[class*='response']",
        "div[class*='model-response-text']",
        "div[class*='response-container'] message-content",
        "div[class*='response-container']",
        "message-content",
        "model-response",
        ".conversation-container model-response",
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
    /token limit/i,
    /maximum length/i,
    /too many tokens/i,
    /out of tokens/i,
    /no tokens/i,
    /insufficient tokens/i,
    /usage limit/i,
    /message limit/i,
    /limit reached/i,
    /rate limit/i,
    /quota/i,
    /credits?/i,
    /remaining messages?/i,
    /try again (later|after|tomorrow)/i,
    /exceeds? (the )?(maximum|limit)/i,
    /토큰.*(초과|한도|없|부족)/i,
    /(남은|잔여).*(메시지|토큰).*(없|부족)/i,
    /(사용량|메시지|토큰).*(한도|제한)/i,
    /(한도|제한).*(도달|초과)/i,
    /크레딧.*(없|부족|초과)/i,
    /나중에 다시/i,
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
    if (selector.includes(":has-text(")) return [];
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
    if (await anyVisible(selectors.loggedInIndicators, 1200)) return true;
    return !(await anyVisible(selectors.loginRequiredIndicators, 500));
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
    const bodyText = document.body.innerText || "";
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
    await sleep(80);
    if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
      setNativeValue(input, message);
      return;
    }
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(input);
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand("delete", false);
    document.execCommand("insertText", false, message);
    input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: message }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function submit(input) {
    const selectors = SELECTORS[service];
    const deadline = Date.now() + 5000;
    let sawDisabledSendButton = false;
    while (Date.now() < deadline) {
      throwIfAborted();
      throwIfPageError();
      const button = (await findFirst(selectors.sendButton, 300)) || findLikelySendButton();
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
    pressEnter(input);
  }

  function findLikelySendButton() {
    const labels = /send|submit|보내기|전송|메시지 보내기/i;
    return [...document.querySelectorAll("button")]
      .filter((button) => isVisible(button))
      .find((button) => {
        const text = [
          button.getAttribute("aria-label"),
          button.getAttribute("title"),
          button.getAttribute("mattooltip"),
          button.innerText,
          button.textContent,
        ].filter(Boolean).join(" ");
        return labels.test(text) && !/stop|중지/i.test(text);
      }) || null;
  }

  function pressEnter(input) {
    input.focus();
    for (const type of ["keydown", "keypress", "keyup"]) {
      input.dispatchEvent(new KeyboardEvent(type, { key: "Enter", code: "Enter", bubbles: true, cancelable: true }));
    }
  }

  function countAssistantMessages() {
    const selectors = SELECTORS[service];
    for (const selector of selectors.assistantMessage) {
      const items = query(selector);
      if (items.length) return items.length;
    }
    if (service === "GEMINI") return 0;
    const fallback = fallbackAssistantCandidates();
    if (fallback.length) return fallback.length;
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
    if (service === "GEMINI") return "";
    const fallback = fallbackAssistantCandidates();
    if (fallback.length) {
      return fallback[fallback.length - 1].text;
    }
    return "";
  }

  function fallbackAssistantCandidates() {
    const input = query(SELECTORS[service].input[0])[0] || document.activeElement;
    const inputRect = input?.getBoundingClientRect?.();
    const minTop = inputRect ? Math.max(0, inputRect.top - window.innerHeight * 2) : 0;
    const candidates = [...document.querySelectorAll("main article, main [data-testid], main .prose, main .markdown, main p, main div")]
      .filter((el) => isVisible(el))
      .map((el) => ({ el, rect: el.getBoundingClientRect(), text: (el.innerText || el.textContent || "").trim() }))
      .filter((item) => {
        if (!item.text || item.text.length < 20) return false;
        if (inputRect && item.rect.top > inputRect.top) return false;
        if (item.rect.top < minTop) return false;
        if (item.el.matches("button, textarea, input, [contenteditable='true']")) return false;
        if (item.el.closest("button, textarea, input, [contenteditable='true']")) return false;
        if (item.el.closest("nav, aside, [role='navigation'], bard-sidenav, side-navigation, mat-sidenav")) return false;
        return !ERROR_PATTERNS.some((pattern) => pattern.test(item.text));
      });

    const byText = new Map();
    for (const item of candidates) {
      const prev = byText.get(item.text);
      if (!prev || item.text.length > prev.text.length) byText.set(item.text, item);
    }
    return [...byText.values()].sort((a, b) => a.rect.top - b.rect.top);
  }

  async function isGenerating() {
    return anyVisible(SELECTORS[service].stopButton, 200);
  }

  async function continueIfAvailable() {
    const selectors = SELECTORS[service].continueButton || [];
    const button = await findFirst(selectors, 300);
    if (!button || button.disabled || button.getAttribute("aria-disabled") === "true") return false;
    button.click();
    await sleep(1200);
    return true;
  }

  function looksCutOff(text) {
    const trimmed = text.trim();
    if (trimmed.length < 80) return false;
    if (/[.!?。！？…)"'\]\}]$/.test(trimmed)) return false;
    if (/```[^`]*$/.test(trimmed)) return true;
    return /[,;:，、]$/.test(trimmed) || /(\b(and|or|but|because|with|for|to|of|in|that|which)|[가-힣](고|며|서|는|를|을|의|에|로|와|과))$/i.test(trimmed);
  }

  async function waitForStableText({ baselineCount, baselineText, timeoutMs, stabilizeMs }) {
    const startDeadline = Date.now() + Math.min(15000, timeoutMs);
    let started = false;
    while (Date.now() < startDeadline) {
      throwIfAborted();
      throwIfPageError();
      const latest = readLatestAssistantText();
      if (countAssistantMessages() > baselineCount || await isGenerating() || (latest && latest !== baselineText)) {
        started = true;
        break;
      }
      await sleep(400);
    }
    if (!started) {
      throwIfPageError();
      throw new Error("RESPONSE_NOT_STARTED");
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
        if (await continueIfAvailable()) {
          stableSince = Date.now();
          continue;
        }
        if (looksCutOff(lastText)) {
          await sleep(Math.min(3000, stabilizeMs));
          const retryText = readLatestAssistantText();
          if (retryText !== lastText) {
            lastText = retryText;
            stableSince = Date.now();
            continue;
          }
        }
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
    const baselineText = readLatestAssistantText();
    const input = await findFirst(selectors.input, 2500);
    if (!input) throw new Error("INPUT_NOT_FOUND");
    await typeMessage(input, prompt);
    throwIfPageError();
    await submit(input);
    throwIfPageError();
    const text = await waitForStableText({ baselineCount, baselineText, timeoutMs, stabilizeMs });
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
