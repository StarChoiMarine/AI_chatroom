import express, { type Express, type Request, type Response } from "express";
import path from "node:path";
import { createRequire } from "node:module";
import type { ConversationOrchestrator } from "./orchestrator/ConversationOrchestrator.js";
import type { BaseAIAdapter } from "./adapters/BaseAIAdapter.js";
import type { ConversationStore } from "./storage/ConversationStore.js";
import type { PageRegistry } from "./browser/PageRegistry.js";
import type { AppSettings, ServiceId } from "./types/index.js";
import { DEFAULT_ROLES } from "./config/defaults.js";
import { toJson, toMarkdown } from "./utils/exporter.js";
import { logger } from "./utils/logger.js";

const require = createRequire(import.meta.url);

export interface AppContext {
  orchestrator: ConversationOrchestrator;
  adapters: Record<ServiceId, BaseAIAdapter>;
  store: ConversationStore;
  registry: PageRegistry;
  // 새 대화방을 새 roomId 로 시작하는 함수 (index.ts 에서 주입)
  startNewRoom: (opts: { resetWeb: boolean }) => Promise<void>;
}

const SERVICES: ServiceId[] = ["CHATGPT", "CLAUDE", "GEMINI"];

export function createApp(ctx: AppContext): Express {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  // 정적 프론트엔드
  app.use(express.static(path.resolve("public")));

  // 로컬 서빙: marked / dompurify (CDN 불필요)
  try {
    app.get("/vendor/marked.js", (_req, res) =>
      res.sendFile(require.resolve("marked/marked.min.js")),
    );
    app.get("/vendor/purify.js", (_req, res) =>
      res.sendFile(require.resolve("dompurify/dist/purify.min.js")),
    );
  } catch (e) {
    logger.warn("marked/dompurify 로컬 경로 확인 실패 (npm install 필요할 수 있음).");
  }

  // ---- 상태 조회 ----
  app.get("/api/state", async (_req: Request, res: Response) => {
    const room = ctx.orchestrator.getRoom();
    const health = await Promise.all(SERVICES.map((s) => ctx.adapters[s].healthCheck()));
    res.json({ room, health, busy: ctx.orchestrator.isBusy() });
  });

  app.get("/api/health", async (_req, res) => {
    const health = await Promise.all(SERVICES.map((s) => ctx.adapters[s].healthCheck()));
    res.json({ health });
  });

  // ---- 메시지 전송 (비동기 실행, 진행상황은 소켓으로) ----
  app.post("/api/message", async (req, res) => {
    const text = String(req.body?.text ?? "").trim();
    if (!text) return res.status(400).json({ error: "메시지가 비어 있습니다." });
    if (ctx.orchestrator.isBusy() && !ctx.orchestrator.getSettings().allowSendWhileGenerating) {
      return res.status(409).json({ error: "이미 답변을 처리 중입니다." });
    }
    res.status(202).json({ ok: true });
    ctx.orchestrator.handleUserMessage(text).catch((e) => logger.error(`처리 오류: ${e.message}`));
  });

  // ---- 중단 ----
  app.post("/api/abort", async (_req, res) => {
    await ctx.orchestrator.abort();
    res.json({ ok: true });
  });

  // ---- 특정 서비스만 재시도 ----
  app.post("/api/retry", async (req, res) => {
    const service = String(req.body?.service ?? "").toUpperCase() as ServiceId;
    if (!SERVICES.includes(service)) return res.status(400).json({ error: "알 수 없는 서비스" });
    res.status(202).json({ ok: true });
    ctx.orchestrator.retryService(service).catch((e) => logger.error(`재시도 오류: ${e.message}`));
  });

  // ---- 로그인 상태 다시 확인 ----
  app.post("/api/check-login", async (req, res) => {
    const service = req.body?.service ? (String(req.body.service).toUpperCase() as ServiceId) : null;
    const list = service ? [service] : SERVICES;
    const result: Record<string, boolean> = {};
    for (const s of list) {
      await ctx.adapters[s].open();
      result[s] = await ctx.adapters[s].checkLogin();
    }
    res.json({ result });
  });

  // ---- 서비스 탭 열기 / 재연결 ----
  app.post("/api/open-tab", async (req, res) => {
    const service = String(req.body?.service ?? "").toUpperCase() as ServiceId;
    if (!SERVICES.includes(service)) return res.status(400).json({ error: "알 수 없는 서비스" });
    await ctx.adapters[service].open();
    res.json({ ok: true });
  });

  app.post("/api/reconnect", async (req, res) => {
    const service = String(req.body?.service ?? "").toUpperCase() as ServiceId;
    if (!SERVICES.includes(service)) return res.status(400).json({ error: "알 수 없는 서비스" });
    const url = ctx.orchestrator.getSettings().services[service].url;
    await ctx.registry.reconnect(service, url);
    res.json({ ok: true });
  });

  // ---- 새 대화 ----
  app.post("/api/new-chat", async (req, res) => {
    const resetWeb = Boolean(req.body?.resetWeb);
    await ctx.startNewRoom({ resetWeb });
    res.json({ ok: true, room: ctx.orchestrator.getRoom() });
  });

  // ---- 설정 ----
  app.get("/api/settings", (_req, res) => {
    res.json({ settings: ctx.orchestrator.getSettings() });
  });

  app.post("/api/settings", (req, res) => {
    const partial = req.body?.settings as Partial<AppSettings> | undefined;
    if (!partial) return res.status(400).json({ error: "설정이 없습니다." });
    ctx.orchestrator.updateSettings(partial);
    res.json({ ok: true, settings: ctx.orchestrator.getSettings() });
  });

  app.post("/api/settings/reset-roles", (_req, res) => {
    ctx.orchestrator.updateSettings({ roles: { ...DEFAULT_ROLES } });
    res.json({ ok: true, settings: ctx.orchestrator.getSettings() });
  });

  // ---- 내보내기 ----
  app.get("/api/export/markdown", (_req, res) => {
    const room = ctx.orchestrator.getRoom();
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="roundtable_${room.id}.md"`);
    res.send(toMarkdown(room));
  });

  app.get("/api/export/json", (_req, res) => {
    const room = ctx.orchestrator.getRoom();
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="roundtable_${room.id}.json"`);
    res.send(toJson(room));
  });

  // ---- 대화방 목록/불러오기/삭제 ----
  app.get("/api/rooms", async (_req, res) => {
    res.json({ rooms: await ctx.store.listRooms() });
  });

  app.post("/api/rooms/delete-all", async (_req, res) => {
    await ctx.store.deleteAll();
    res.json({ ok: true });
  });

  return app;
}
