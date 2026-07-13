import { BaseAIAdapter, type AdapterDeps } from "./BaseAIAdapter.js";
import { chatgptSelectors } from "../selectors/chatgpt.selectors.js";
import type { ServiceId } from "../types/index.js";

export class ChatGPTAdapter extends BaseAIAdapter {
  readonly service: ServiceId = "CHATGPT";
  readonly selectors = chatgptSelectors;

  constructor(deps: AdapterDeps) {
    super(deps);
  }
}
