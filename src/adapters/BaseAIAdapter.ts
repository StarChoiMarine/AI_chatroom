import type { Locator, Page } from "playwright";
import type { AIHealthStatus, AppSettings, ServiceId } from "../types/index.js";
import { SERVICE_LABELS } from "../types/index.js";
import type { ServiceSelectors } from "../selectors/index.js";
import type { PageRegistry } from "../browser/PageRegistry.js";
import type { BrowserManager } from "../browser/BrowserManager.js";
import { logger } from "../utils/logger.js";
import { withRetry, sleep } from "../utils/retry.js";
import { waitForStableText } from "../utils/textStability.js";
import { LoginRequiredError, ResponseTimeoutError, SelectorNotFoundError, AbortedError } from "./errors.js";

export interface AdapterDeps {
  registry: PageRegistry;
  browser: BrowserManager;
  getSettings: () => AppSettings;
}

/**
 * 모든 AI 서비스 Adapter의 공통 로직.
 * 서비스별 차이는 selectors 와 소수의 override 훅으로만 처리한다.
 */
export abstract class BaseAIAdapter {
  abstract readonly service: ServiceId;
  abstract readonly selectors: ServiceSelectors;

  // waitForResponse 동안 스트리밍 텍스트를 외부로 알리는 콜백
  onStreaming?: (text: string) => void;
  // 중단 요청 확인용
  private aborted = false;

  private baselineCount = 0;
  private latestText = "";

  constructor(protected deps: AdapterDeps) {}

  get name(): string {
    return SERVICE_LABELS[this.service];
  }

  protected get url(): string {
    return this.deps.getSettings().services[this.service].url;
  }

  protected async page(): Promise<Page> {
    return this.deps.registry.ensurePage(this.service, this.url);
  }

  // ---- 선택자 유틸: 후보 목록을 순서대로 시도 ----

  protected async findFirst(candidates: string[], timeoutEach = 1500): Promise<Locator | null> {
    const page = await this.page();
    for (const sel of candidates) {
      try {
        const loc = page.locator(sel).first();
        await loc.waitFor({ state: "visible", timeout: timeoutEach });
        return loc;
      } catch {
        /* 다음 후보 시도 */
      }
    }
    return null;
  }

  protected async anyVisible(candidates: string[], timeoutEach = 1200): Promise<boolean> {
    return (await this.findFirst(candidates, timeoutEach)) !== null;
  }

  // ---- 공개 인터페이스 ----

  async open(): Promise<void> {
    await this.deps.registry.ensurePage(this.service, this.url);
  }

  async checkLogin(): Promise<boolean> {
    const page = await this.page();
    // 로그인 필요 지표가 명확히 보이면 false
    const needLogin = await this.anyVisible(this.selectors.loginRequiredIndicators, 1000);
    if (needLogin) return false;
    // 입력창 등 로그인 지표가 보이면 true
    const loggedIn = await this.anyVisible(this.selectors.loggedInIndicators, 2000);
    return loggedIn;
  }

  async startNewConversation(): Promise<void> {
    const page = await this.page();
    const btn = await this.findFirst(this.selectors.newChat, 2000);
    if (btn) {
      await btn.click().catch(() => {});
      await sleep(1200);
    } else {
      // 버튼을 못 찾으면 기본 URL로 이동
      await page.goto(this.url, { waitUntil: "domcontentloaded" }).catch(() => {});
      await sleep(1200);
    }
    logger.info(`${this.name} 새 대화 시작.`);
  }

  markAbort() {
    this.aborted = true;
  }
  clearAbort() {
    this.aborted = false;
  }

  private async countAssistantMessages(): Promise<number> {
    const page = await this.page();
    for (const sel of this.selectors.assistantMessage) {
      try {
        const n = await page.locator(sel).count();
        if (n > 0) return n;
      } catch {
        /* 다음 후보 */
      }
    }
    return 0;
  }

  private async readLatestAssistantText(): Promise<string> {
    const page = await this.page();
    for (const sel of this.selectors.assistantMessage) {
      try {
        const loc = page.locator(sel);
        const n = await loc.count();
        if (n > 0) {
          const text = await loc.nth(n - 1).innerText();
          if (text && text.trim().length > 0) return text.trim();
        }
      } catch {
        /* 다음 후보 */
      }
    }
    return "";
  }

  private async isGenerating(): Promise<boolean> {
    return this.anyVisible(this.selectors.stopButton, 400);
  }

  /**
   * 메시지를 입력창에 넣고 전송한다.
   * 전송 직전, 기존 답변 개수를 baseline 으로 기록한다.
   */
  async sendMessage(message: string): Promise<void> {
    if (this.aborted) throw new AbortedError();

    // 전송 전 상태 확인
    if (!(await this.checkLogin())) {
      throw new LoginRequiredError(this.name);
    }

    this.baselineCount = await this.countAssistantMessages();
    this.latestText = "";

    await withRetry(
      async () => {
        const input = await this.findFirst(this.selectors.input, 2500);
        if (!input) throw new SelectorNotFoundError(this.name, "입력창", this.selectors.input);

        await input.click({ timeout: 3000 });
        await this.typeMessage(input, message);

        await this.submit(input);
      },
      { label: `${this.name} 메시지 전송`, retries: 3 },
    );

    logger.info(`${this.name} 메시지 전송 완료 (${message.length}자).`);
  }

  /** 입력창에 텍스트를 넣는다. fill 우선, 실패 시 키보드 입력. (override 가능) */
  protected async typeMessage(input: Locator, message: string): Promise<void> {
    try {
      await input.fill(message, { timeout: 4000 });
    } catch {
      const page = await this.page();
      await input.click();
      await page.keyboard.insertText(message);
    }
  }

  /** 전송: 전송 버튼 클릭 → 실패 시 Enter. (override 가능) */
  protected async submit(input: Locator): Promise<void> {
    const btn = await this.findFirst(this.selectors.sendButton, 1500);
    if (btn) {
      try {
        await btn.click({ timeout: 3000 });
        return;
      } catch {
        /* Enter 로 폴백 */
      }
    }
    const page = await this.page();
    await input.press("Enter").catch(async () => {
      await page.keyboard.press("Enter");
    });
  }

  /**
   * 새 답변이 시작되어 완료(안정화)될 때까지 대기한다.
   */
  async waitForResponse(): Promise<void> {
    const settings = this.deps.getSettings();

    // 1) 새 답변 블록이 나타날 때까지 대기 (baseline 대비 증가 or Stop 버튼 등장)
    const startDeadline = Date.now() + 30000;
    while (Date.now() < startDeadline) {
      if (this.aborted) throw new AbortedError();
      const count = await this.countAssistantMessages();
      const generating = await this.isGenerating();
      if (count > this.baselineCount || generating) break;
      await sleep(500);
    }

    // 2) 텍스트가 안정화될 때까지 대기
    const result = await waitForStableText({
      getText: () => this.readLatestAssistantText(),
      isStillGenerating: () => this.isGenerating(),
      timeoutMs: settings.responseTimeoutMs,
      stabilizeMs: settings.stabilizeMs,
      onStreaming: (t) => this.onStreaming?.(t),
      shouldAbort: () => this.aborted,
    });

    if (result.aborted) throw new AbortedError();
    if (result.timedOut && result.text.length === 0) {
      throw new ResponseTimeoutError(this.name);
    }

    // 빈 답변이면 한 번 더 잠깐 기다렸다가 재수집
    if (result.text.length === 0) {
      await sleep(1500);
      this.latestText = await this.readLatestAssistantText();
    } else {
      this.latestText = result.text;
    }

    if (this.latestText.length === 0) {
      throw new ResponseTimeoutError(this.name);
    }
  }

  async getLatestResponse(): Promise<string> {
    return this.latestText;
  }

  async stopGeneration(): Promise<void> {
    const btn = await this.findFirst(this.selectors.stopButton, 1000);
    if (btn) await btn.click().catch(() => {});
  }

  async healthCheck(): Promise<AIHealthStatus> {
    const connected = this.deps.registry.isConnected(this.service);
    let loggedIn = false;
    let url = this.url;
    let detail: string | undefined;
    try {
      if (connected) {
        const page = this.deps.registry.get(this.service)!;
        url = page.url();
        loggedIn = await this.checkLogin();
      }
    } catch (err) {
      detail = (err as Error).message;
    }
    return { service: this.service, loggedIn, connected, url, detail };
  }
}
