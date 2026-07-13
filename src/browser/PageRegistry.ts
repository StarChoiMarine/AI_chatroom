import type { Page } from "playwright";
import type { ServiceId } from "../types/index.js";
import type { BrowserManager } from "./BrowserManager.js";
import { logger } from "../utils/logger.js";

/**
 * PageRegistry
 * - 서비스별 전용 탭(Page)을 관리한다.
 * - 탭이 닫혔는지 확인하고, 필요 시 다시 연다.
 * - 사이트가 리디렉션되어도 해당 서비스의 페이지 참조를 유지한다.
 */
export class PageRegistry {
  private pages = new Map<ServiceId, Page>();

  constructor(private browser: BrowserManager) {}

  /** 서비스 페이지를 반환하되, 없거나 닫혔으면 새로 연다. */
  async ensurePage(service: ServiceId, url: string): Promise<Page> {
    const existing = this.pages.get(service);
    if (existing && !existing.isClosed()) {
      return existing;
    }

    logger.info(`${service} 탭을 엽니다: ${url}`);
    const page = await this.browser.openPage(url);
    page.on("close", () => {
      logger.warn(`${service} 탭이 닫혔습니다.`);
    });
    this.pages.set(service, page);
    return page;
  }

  get(service: ServiceId): Page | undefined {
    const p = this.pages.get(service);
    if (p && !p.isClosed()) return p;
    return undefined;
  }

  isConnected(service: ServiceId): boolean {
    const p = this.pages.get(service);
    return !!p && !p.isClosed();
  }

  /** 페이지를 현재 URL 그대로 다시 연결(재사용) — 사용자가 직접 조작한 뒤 재개용. */
  async reconnect(service: ServiceId, fallbackUrl: string): Promise<Page> {
    const p = this.pages.get(service);
    if (p && !p.isClosed()) return p;
    return this.ensurePage(service, fallbackUrl);
  }

  all(): [ServiceId, Page][] {
    return [...this.pages.entries()].filter(([, p]) => !p.isClosed());
  }
}
