import type { Locator } from "playwright";
import { BaseAIAdapter, type AdapterDeps } from "./BaseAIAdapter.js";
import { geminiSelectors } from "../selectors/gemini.selectors.js";
import type { ServiceId } from "../types/index.js";

export class GeminiAdapter extends BaseAIAdapter {
  readonly service: ServiceId = "GEMINI";
  readonly selectors = geminiSelectors;

  constructor(deps: AdapterDeps) {
    super(deps);
  }

  // Gemini 입력창은 Quill(ql-editor, contenteditable) 이라 insertText 를 사용한다.
  protected override async typeMessage(input: Locator, message: string): Promise<void> {
    const page = await this.page();
    await input.click();
    await page.keyboard.insertText(message);
  }
}
