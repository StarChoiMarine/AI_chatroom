import type { ServiceSelectors } from "./types.js";

// ChatGPT (chatgpt.com) 선택자.
// 사이트 구조 변경 시 이 배열들만 수정하면 된다.
export const chatgptSelectors: ServiceSelectors = {
  loggedInIndicators: [
    '#prompt-textarea',
    'div[contenteditable="true"]#prompt-textarea',
    'textarea[data-id]',
    'form textarea',
  ],
  loginRequiredIndicators: [
    'button[data-testid="login-button"]',
    'a[href*="auth/login"]',
    'text=/Log in|로그인/i',
  ],
  input: [
    '#prompt-textarea',
    'div[contenteditable="true"]#prompt-textarea',
    'textarea[data-id]',
    'textarea[placeholder]',
    'div[contenteditable="true"]',
    'form textarea',
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
    '.markdown.prose',
  ],
  newChat: [
    'a[data-testid="create-new-chat-button"]',
    'a[href="/"]',
    'button[aria-label*="New chat"]',
    'nav a:has-text("New chat")',
  ],
};
