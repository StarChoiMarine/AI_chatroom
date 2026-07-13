import path from "node:path";
import fs from "node:fs";
import { chromium, type BrowserContext, type Page } from "playwright";
import { logger } from "../utils/logger.js";
import type { ServiceId } from "../types/index.js";

const PROFILE_DIR = path.resolve("browser-profile");

/**
 * BrowserManager
 * - 자동화 전용 Persistent Chrome 실행 (사용자 기본 프로필과 분리)
 * - headless:false, channel:"chrome" 로 실제 화면이 보이는 브라우저 사용
 * - 세션 쿠키/로그인 정보는 browser-profile/ 에 저장되어 재실행 시 유지
 */
export class BrowserManager {
  private context: BrowserContext | null = null;

  async launch(): Promise<BrowserContext> {
    if (this.context) return this.context;

    if (!fs.existsSync(PROFILE_DIR)) fs.mkdirSync(PROFILE_DIR, { recursive: true });

    logger.info(`자동화 전용 Chrome 실행 중... (프로필: ${PROFILE_DIR})`);

    this.context = await chromium.launchPersistentContext(PROFILE_DIR, {
      headless: false,
      channel: "chrome",
      viewport: null, // 실제 창 크기 사용
      args: ["--start-maximized"],
    });

    // 브라우저가 사용자에 의해 종료되면 context 참조를 정리
    this.context.on("close", () => {
      logger.warn("브라우저 컨텍스트가 종료되었습니다.");
      this.context = null;
    });

    logger.info("Chrome 실행 완료.");
    return this.context;
  }

  getContext(): BrowserContext | null {
    return this.context;
  }

  isAlive(): boolean {
    return this.context !== null;
  }

  /** 지정한 URL로 새 탭(페이지)을 연다. */
  async openPage(url: string): Promise<Page> {
    const ctx = await this.launch();
    const page = await ctx.newPage();
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    } catch (err) {
      logger.warn(`페이지 로드 지연/실패 (${url}): ${(err as Error).message}`);
    }
    return page;
  }

  async saveScreenshot(page: Page, service: ServiceId, stage: string): Promise<string | null> {
    try {
      const dir = path.resolve("logs/screenshots");
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, `${service}_${stage}_${Date.now()}.png`);
      await page.screenshot({ path: file, fullPage: false });
      return file;
    } catch (err) {
      logger.warn(`스크린샷 저장 실패: ${(err as Error).message}`);
      return null;
    }
  }

  async close(): Promise<void> {
    if (this.context) {
      await this.context.close().catch(() => {});
      this.context = null;
    }
  }
}
