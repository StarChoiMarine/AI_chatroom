import type { ServiceSelectors } from "./types.js";

// Claude (claude.ai) 선택자.
export const claudeSelectors: ServiceSelectors = {
  loggedInIndicators: [
    'div[contenteditable="true"].ProseMirror',
    'div[contenteditable="true"]',
    'fieldset div[contenteditable="true"]',
  ],
  loginRequiredIndicators: [
    'input[name="email"]',
    'button:has-text("Continue with Google")',
    'text=/Log in|로그인|Sign in/i',
  ],
  input: [
    'div[contenteditable="true"].ProseMirror',
    'div[contenteditable="true"][translate="no"]',
    'div[contenteditable="true"]',
    'textarea',
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
    'div.font-claude-message',
    'div[data-is-streaming] div.font-claude-message',
    'div.font-claude-response',
  ],
  newChat: [
    'a[href="/new"]',
    'button[aria-label*="New chat"]',
    'a:has-text("New chat")',
  ],
};
