import http from "node:http";
import { nanoid } from "nanoid";
import { createApp, type AppContext } from "./server.js";
import { SocketManager } from "./websocket/SocketManager.js";
import { BrowserManager } from "./browser/BrowserManager.js";
import { PageRegistry } from "./browser/PageRegistry.js";
import { ChatGPTAdapter } from "./adapters/ChatGPTAdapter.js";
import { ClaudeAdapter } from "./adapters/ClaudeAdapter.js";
import { GeminiAdapter } from "./adapters/GeminiAdapter.js";
import type { AdapterDeps, BaseAIAdapter } from "./adapters/BaseAIAdapter.js";
import { ConversationOrchestrator } from "./orchestrator/ConversationOrchestrator.js";
import { JsonConversationStore } from "./storage/JsonConversationStore.js";
import { DEFAULT_SETTINGS } from "./config/defaults.js";
import { logger } from "./utils/logger.js";
import type { AppSettings, Room, ServiceId } from "./types/index.js";

const PORT = Number(process.env.PORT ?? 5173);
const SERVICES: ServiceId[] = ["CHATGPT", "CLAUDE", "GEMINI"];

function newRoom(settings: AppSettings): Room {
  const now = new Date().toISOString();
  return {
    id: nanoid(),
    title: settings.roomTitle,
    createdAt: now,
    updatedAt: now,
    mode: settings.defaultMode,
    settings: structuredClone(settings),
    messages: [],
  };
}

async function main() {
  logger.info("=== AI 원탁회의 시작 ===");

  // 1) 저장소
  const store = new JsonConversationStore();
  await store.init();

  // 2) 브라우저 + 페이지 레지스트리
  const browser = new BrowserManager();
  const registry = new PageRegistry(browser);

  // 현재 설정을 담을 방(오케스트레이터 생성 후 최종 확정)
  let currentRoom: Room = newRoom(DEFAULT_SETTINGS);

  // 3) Adapter (getSettings 는 오케스트레이터의 현재 설정을 지연 참조)
  const deps: AdapterDeps = {
    registry,
    browser,
    getSettings: () => orchestrator?.getSettings() ?? currentRoom.settings,
  };
  const adapters: Record<ServiceId, BaseAIAdapter> = {
    CHATGPT: new ChatGPTAdapter(deps),
    CLAUDE: new ClaudeAdapter(deps),
    GEMINI: new GeminiAdapter(deps),
  };

  // 4) 소켓 + HTTP 서버 (ctx 는 지연 바인딩)
  const ctx = {} as AppContext;
  const app = createApp(ctx);
  const httpServer = http.createServer(app);
  const socket = new SocketManager(httpServer);
  const emit = (e: Parameters<SocketManager["emit"]>[0]) => socket.emit(e);

  // 5) 오케스트레이터
  const orchestrator = new ConversationOrchestrator(adapters, store, emit, currentRoom);

  // ctx 채우기
  ctx.orchestrator = orchestrator;
  ctx.adapters = adapters;
  ctx.store = store;
  ctx.registry = registry;
  ctx.startNewRoom = async ({ resetWeb }) => {
    const settings = orchestrator.getSettings();
    // 이전 방은 이미 저장되어 있으므로 새 방으로 교체
    const room = newRoom(settings);
    orchestrator.setRoom(room);
    await store.saveRoom(room);
    logger.info(`새 대화방 생성: ${room.id}`);
    if (resetWeb) {
      for (const s of SERVICES) {
        if (settings.services[s].enabled) {
          await adapters[s].startNewConversation().catch((e) =>
            logger.warn(`${s} 새 대화 생성 실패: ${e.message}`),
          );
        }
      }
    }
    emit({ type: "PROGRESS", text: "새 대화가 시작되었습니다." });
  };

  // 6) 서버 시작
  httpServer.listen(PORT, () => {
    logger.info(`로컬 서버 실행: http://localhost:${PORT}`);
    logger.info(`브라우저에서 위 주소를 여세요.`);
  });

  // 7) 초기 방 저장
  await store.saveRoom(currentRoom);

  // 8) 자동화 브라우저 실행 + 서비스 탭 열기 + 로그인 확인
  (async () => {
    try {
      await browser.launch();
      for (const s of SERVICES) {
        const cfg = orchestrator.getSettings().services[s];
        if (!cfg.enabled) continue;
        emit({ type: "SERVICE_STATUS_CHANGED", service: s, status: "DISCONNECTED", detail: "탭 여는 중" });
        await adapters[s].open();
        const loggedIn = await adapters[s].checkLogin().catch(() => false);
        emit({
          type: "SERVICE_STATUS_CHANGED",
          service: s,
          status: loggedIn ? "READY" : "LOGIN_REQUIRED",
        });
        logger.info(`${s}: ${loggedIn ? "준비됨" : "로그인 필요"}`);
      }
      emit({ type: "PROGRESS", text: "브라우저 준비 완료. 로그인 상태를 확인하세요." });
    } catch (e) {
      logger.error(`브라우저 초기화 실패: ${(e as Error).message}`);
    }
  })();

  // 종료 처리
  const shutdown = async () => {
    logger.info("종료 중...");
    await browser.close().catch(() => {});
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  logger.error(`치명적 오류: ${e.stack ?? e.message}`);
  process.exit(1);
});
