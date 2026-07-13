import type { Locator } from "playwright";
import { BaseAIAdapter, type AdapterDeps } from "./BaseAIAdapter.js";
import { claudeSelectors } from "../selectors/claude.selectors.js";
import type { ServiceId } from "../types/index.js";

export class ClaudeAdapter extends BaseAIAdapter {
  readonly service: ServiceId = "CLAUDE";
  readonly selectors = claudeSelectors;

  constructor(deps: AdapterDeps) {
    super(deps);
  }

  // Claude 입력창은 ProseMirror(contenteditable) 이라 fill 이 불안정할 수 있어
  // 클릭 후 insertText 를 우선 사용한다.
  protected override async typeMessage(input: Locator, message: string): Promise<void> {
    const page = await this.page();
    await input.click();
    // 기존 내용 정리
    await page.keyboard.press("Control+A").catch(() => {});
    await page.keyboard.press("Delete").catch(() => {});
    await page.keyboard.insertText(message);
  }
}
