import fs from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { Room } from "../types/index.js";
import type { ConversationStore } from "./ConversationStore.js";
import { logger } from "../utils/logger.js";

const DATA_DIR = path.resolve("data");
const ROOMS_DIR = path.join(DATA_DIR, "rooms");

/** 대화방을 room별 JSON 파일로 저장한다. */
export class JsonConversationStore implements ConversationStore {
  async init(): Promise<void> {
    if (!existsSync(ROOMS_DIR)) mkdirSync(ROOMS_DIR, { recursive: true });
  }

  private roomPath(id: string): string {
    return path.join(ROOMS_DIR, `${id}.json`);
  }

  async saveRoom(room: Room): Promise<void> {
    await this.init();
    room.updatedAt = new Date().toISOString();
    const tmp = this.roomPath(room.id) + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(room, null, 2), "utf8");
    await fs.rename(tmp, this.roomPath(room.id));
    logger.debug(`대화방 저장: ${room.id} (${room.messages.length} 메시지)`);
  }

  async getRoom(id: string): Promise<Room | null> {
    try {
      const raw = await fs.readFile(this.roomPath(id), "utf8");
      return JSON.parse(raw) as Room;
    } catch {
      return null;
    }
  }

  async listRooms() {
    await this.init();
    const files = (await fs.readdir(ROOMS_DIR)).filter((f) => f.endsWith(".json"));
    const rooms = await Promise.all(
      files.map(async (f) => {
        try {
          const r = JSON.parse(await fs.readFile(path.join(ROOMS_DIR, f), "utf8")) as Room;
          return { id: r.id, title: r.title, createdAt: r.createdAt, updatedAt: r.updatedAt };
        } catch {
          return null;
        }
      }),
    );
    return rooms
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async deleteRoom(id: string): Promise<void> {
    await fs.rm(this.roomPath(id), { force: true });
  }

  async deleteAll(): Promise<void> {
    await fs.rm(ROOMS_DIR, { recursive: true, force: true });
    await this.init();
  }
}
