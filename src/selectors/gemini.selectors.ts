import type { ServiceSelectors } from "./types.js";

// Gemini (gemini.google.com) 선택자.
export const geminiSelectors: ServiceSelectors = {
  loggedInIndicators: [
    'div.ql-editor[contenteditable="true"]',
    'rich-textarea div[contenteditable="true"]',
    'div[contenteditable="true"]',
  ],
  loginRequiredIndicators: [
    'a[href*="accounts.google.com"]',
    'text=/Sign in|로그인/i',
  ],
  input: [
    'div.ql-editor[contenteditable="true"]',
    'rich-textarea div[contenteditable="true"]',
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"]',
    'textarea',
  ],
  sendButton: [
    'button[aria-label*="Send"]',
    'button[aria-label*="보내기"]',
    'button.send-button',
    'button[mattooltip*="Send"]',
  ],
  stopButton: [
    'button[aria-label*="Stop"]',
    'button[aria-label*="중지"]',
    'button.stop',
  ],
  assistantMessage: [
    'message-content.model-response-text',
    'div.model-response-text',
    'model-response .markdown',
    'message-content',
  ],
  newChat: [
    'button[aria-label*="New chat"]',
    'button[aria-label*="새 채팅"]',
    'a:has-text("New chat")',
  ],
};
