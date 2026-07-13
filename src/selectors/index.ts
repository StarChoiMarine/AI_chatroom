import type { ServiceId } from "../types/index.js";
import type { ServiceSelectors } from "./types.js";
import { chatgptSelectors } from "./chatgpt.selectors.js";
import { claudeSelectors } from "./claude.selectors.js";
import { geminiSelectors } from "./gemini.selectors.js";

export const SELECTORS: Record<ServiceId, ServiceSelectors> = {
  CHATGPT: chatgptSelectors,
  CLAUDE: claudeSelectors,
  GEMINI: geminiSelectors,
};

export type { ServiceSelectors };
