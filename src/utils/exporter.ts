import type { Room } from "../types/index.js";
import { SERVICE_LABELS } from "../types/index.js";

function speaker(room: Room, sp: string): string {
  if (sp === "USER") return room.settings.userName || "사용자";
  if (sp === "SYSTEM") return "시스템";
  return SERVICE_LABELS[sp as keyof typeof SERVICE_LABELS] ?? sp;
}

/** 대화방을 Markdown 문자열로 내보낸다. */
export function toMarkdown(room: Room): string {
  const lines: string[] = [];
  lines.push(`# ${room.title}`);
  lines.push("");
  lines.push(`> 생성: ${room.createdAt}  ·  모드: ${room.mode}`);
  lines.push("");

  for (const m of room.messages) {
    if (m.speaker === "SYSTEM") continue;
    if (m.status === "FAILED") continue;
    lines.push(`## ${speaker(room, m.speaker)}`);
    lines.push("");
    lines.push(m.content);
    lines.push("");
  }
  return lines.join("\n");
}

/** 구조화된 JSON 문자열 */
export function toJson(room: Room): string {
  return JSON.stringify(room, null, 2);
}
