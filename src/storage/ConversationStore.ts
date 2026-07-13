import type { Room } from "../types/index.js";

/**
 * 저장소 추상 인터페이스.
 * MVP는 JSON 구현을 사용하지만, 추후 SQLite 구현으로 교체할 수 있도록 분리한다.
 */
export interface ConversationStore {
  init(): Promise<void>;
  saveRoom(room: Room): Promise<void>;
  getRoom(id: string): Promise<Room | null>;
  listRooms(): Promise<{ id: string; title: string; createdAt: string; updatedAt: string }[]>;
  deleteRoom(id: string): Promise<void>;
  deleteAll(): Promise<void>;
}
