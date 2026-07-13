import { nanoid } from "nanoid";
import type {
  AppSettings,
  ChatMessage,
  OrchestratorEvent,
  Room,
  ServiceId,
  ServiceStatus,
} from "../types/index.js";
import { SERVICE_LABELS } from "../types/index.js";
import type { BaseAIAdapter } from "../adapters/BaseAIAdapter.js";
import type { ConversationStore } from "../storage/ConversationStore.js";
import { buildPrompt } from "./PromptBuilder.js";
import { parseMentions } from "./MentionParser.js";
import { logger } from "../utils/logger.js";
import { sleep } from "../utils/retry.js";
import {
  AbortedError,
  LoginRequiredError,
  ResponseTimeoutError,
  SelectorNotFoundError,
} from "../adapters/errors.js";

type Emit = (event: OrchestratorEvent) => void;

export class ConversationOrchestrator {
  private room: Room;
  private busy = false;
  private abortRequested = false;
  private round = 0;

  constructor(
    private adapters: Record<ServiceId, BaseAIAdapter>,
    private store: ConversationStore,
    private emit: Emit,
    initialRoom: Room,
  ) {
    this.room = initialRoom;
  }

  getRoom(): Room {
    return this.room;
  }

  getSettings(): AppSettings {
    return this.room.settings;
  }

  updateSettings(partial: Partial<AppSettings>): void {
    this.room.settings = { ...this.room.settings, ...partial };
  }

  setRoom(room: Room): void {
    this.room = room;
  }

  isBusy(): boolean {
    return this.busy;
  }

  // ---- 상태 방출 헬퍼 ----
  private setStatus(service: ServiceId, status: ServiceStatus, detail?: string) {
    this.emit({ type: "SERVICE_STATUS_CHANGED", service, status, detail });
  }
  private progress(text: string) {
    this.emit({ type: "PROGRESS", text });
    logger.info(text);
  }

  private addMessage(msg: ChatMessage) {
    this.room.messages.push(msg);
    this.emit({ type: "MESSAGE_ADDED", message: msg });
  }

  private async persist() {
    if (this.room.settings.autoSave) {
      await this.store.saveRoom(this.room).catch((e) => logger.warn(`저장 실패: ${e.message}`));
    }
  }

  // ---- 중단 ----
  async abort(): Promise<void> {
    if (!this.busy) return;
    this.abortRequested = true;
    this.progress("전체 대화 중단 요청됨.");
    for (const svc of Object.keys(this.adapters) as ServiceId[]) {
      this.adapters[svc].markAbort();
      await this.adapters[svc].stopGeneration().catch(() => {});
    }
    this.emit({ type: "ABORTED" });
  }

  private clearAbort() {
    this.abortRequested = false;
    for (const svc of Object.keys(this.adapters) as ServiceId[]) {
      this.adapters[svc].clearAbort();
    }
  }

  /** 발언 순서 결정: 멘션이 있으면 우선, 없으면 기본 순서. 비활성 서비스는 제외. */
  private resolveTargets(text: string): ServiceId[] {
    const settings = this.room.settings;
    const order = settings.speakingOrder.filter((s) => settings.services[s].enabled);

    const mention = parseMentions(text);
    if (mention.targets === "ALL") return order;
    if (mention.targets && mention.targets.length > 0) {
      // 지정된 대상만, 기본 순서 유지
      return order.filter((s) => (mention.targets as ServiceId[]).includes(s));
    }
    return order; // 멘션 없음 → 원탁회의 기본 순서
  }

  // ---- 메인 진입점 ----
  async handleUserMessage(text: string): Promise<void> {
    if (this.busy && !this.room.settings.allowSendWhileGenerating) {
      throw new Error("이미 답변을 처리 중입니다.");
    }
    this.busy = true;
    this.clearAbort();
    this.round += 1;

    try {
      const userMsg: ChatMessage = {
        id: nanoid(),
        roomId: this.room.id,
        speaker: "USER",
        content: text,
        createdAt: new Date().toISOString(),
        round: this.round,
        status: "COMPLETED",
      };
      this.addMessage(userMsg);
      await this.persist();

      const targets = this.resolveTargets(text);
      if (targets.length === 0) {
        this.progress("응답할 활성 AI가 없습니다.");
        return;
      }

      for (const service of targets) {
        if (this.abortRequested) break;
        await this.runService(service);
        if (this.abortRequested) break;
        if (this.room.settings.delayBetweenMs > 0) {
          await sleep(this.room.settings.delayBetweenMs);
        }
      }

      this.emit({ type: "ROUND_COMPLETED", round: this.round });
    } finally {
      this.busy = false;
      await this.persist();
    }
  }

  /** 특정 서비스 한 명만 다시 시도 (실패/건너뛴 뒤 재시도용). */
  async retryService(service: ServiceId): Promise<void> {
    if (this.busy) throw new Error("처리 중에는 재시도할 수 없습니다.");
    this.busy = true;
    this.clearAbort();
    try {
      await this.runService(service);
    } finally {
      this.busy = false;
      await this.persist();
    }
  }

  /** 한 서비스에 대해: 전송 → 대기 → 수집 → 기록 */
  private async runService(service: ServiceId): Promise<void> {
    const label = SERVICE_LABELS[service];
    const adapter = this.adapters[service];

    // AI 답변 메시지(진행 중 placeholder)
    const aiMsg: ChatMessage = {
      id: nanoid(),
      roomId: this.room.id,
      speaker: service,
      content: "",
      createdAt: new Date().toISOString(),
      round: this.round,
      status: "SENDING",
    };
    this.addMessage(aiMsg);

    // 스트리밍 콜백 (과도한 emit 방지: 400ms throttle)
    let lastEmit = 0;
    adapter.onStreaming = (t: string) => {
      aiMsg.content = t;
      aiMsg.status = "STREAMING";
      const now = Date.now();
      if (now - lastEmit > 400) {
        lastEmit = now;
        this.emit({ type: "RESPONSE_STREAMING", service });
        this.emit({ type: "MESSAGE_ADDED", message: aiMsg }); // 프론트에서 동일 id 갱신
      }
    };

    try {
      // 컨텍스트 구성: 지금까지의 공용 대화 기록(COMPLETED)만 포함
      const prompt = buildPrompt(service, this.room.messages, this.room.settings);

      this.setStatus(service, "SENDING");
      this.emit({ type: "MESSAGE_SENDING", service });
      this.progress(`${label}에 현재까지의 대화를 전달하고 있습니다.`);
      await adapter.sendMessage(prompt);

      this.setStatus(service, "GENERATING");
      this.emit({ type: "RESPONSE_STARTED", service });
      this.progress(`${label}가 답변을 작성하고 있습니다.`);
      await adapter.waitForResponse();

      const answer = await adapter.getLatestResponse();
      aiMsg.content = answer;
      aiMsg.status = "COMPLETED";
      this.setStatus(service, "DONE");
      this.emit({ type: "RESPONSE_COMPLETED", service, message: aiMsg });
      this.progress(`${label} 답변을 수집했습니다. (${answer.length}자)`);
      await this.persist();
    } catch (err) {
      adapter.onStreaming = undefined;
      const e = err as Error;
      const { detail, status } = this.classifyError(service, e);
      aiMsg.status = "FAILED";
      aiMsg.errorMessage = detail;
      // 실패 메시지는 다음 AI 컨텍스트에서 제외됨(PromptBuilder가 COMPLETED만 사용)
      this.setStatus(service, status);
      this.emit({ type: "RESPONSE_FAILED", service, error: detail });
      this.emit({ type: "MESSAGE_ADDED", message: aiMsg });
      logger.error(`${label} 실패: ${detail}`);
      await this.persist();
      // 오류가 나도 전체는 종료하지 않고 다음 AI로 진행한다.
    } finally {
      adapter.onStreaming = undefined;
    }
  }

  private classifyError(
    service: ServiceId,
    e: Error,
  ): { detail: string; status: ServiceStatus } {
    const url = this.adapters[service] ? "" : "";
    if (e instanceof LoginRequiredError) {
      logger.warn(`${service} 로그인 만료. url=${url}`);
      return { detail: `${SERVICE_LABELS[service]} 로그인이 만료되었습니다. 브라우저에서 다시 로그인하세요.`, status: "LOGIN_REQUIRED" };
    }
    if (e instanceof SelectorNotFoundError) {
      return {
        detail: `${SERVICE_LABELS[service]} 페이지 구조가 변경되었거나 입력창/답변 영역을 찾지 못했습니다. 시도한 선택자: ${e.triedSelectors.join(", ")}`,
        status: "ERROR",
      };
    }
    if (e instanceof ResponseTimeoutError) {
      return { detail: `${SERVICE_LABELS[service]}의 답변 시간이 초과되었습니다.`, status: "ERROR" };
    }
    if (e instanceof AbortedError) {
      return { detail: "중단되었습니다.", status: "PAUSED" };
    }
    return { detail: e.message || "알 수 없는 오류", status: "ERROR" };
  }
}
