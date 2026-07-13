import type { Server as HttpServer } from "node:http";
import { Server as IOServer, type Socket } from "socket.io";
import type { OrchestratorEvent } from "../types/index.js";
import { logger } from "../utils/logger.js";

/**
 * SocketManager
 * 오케스트레이터의 진행 상태를 프론트엔드로 실시간 브로드캐스트한다.
 */
export class SocketManager {
  private io: IOServer;

  constructor(server: HttpServer) {
    this.io = new IOServer(server, { cors: { origin: "*" } });
    this.io.on("connection", (socket: Socket) => {
      logger.debug(`소켓 연결됨: ${socket.id}`);
      socket.on("disconnect", () => logger.debug(`소켓 해제됨: ${socket.id}`));
    });
  }

  emit(event: OrchestratorEvent): void {
    this.io.emit("orchestrator", event);
  }
}
