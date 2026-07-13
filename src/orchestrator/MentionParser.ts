import type { ServiceId } from "../types/index.js";

export interface MentionResult {
  targets: ServiceId[] | "ALL" | null; // null = 멘션 없음(기본 모드 사용)
  cleaned: string; // 멘션 토큰을 제거하지 않고 원문 유지 (AI가 지목 맥락을 이해하도록)
}

const MENTION_MAP: { pattern: RegExp; service: ServiceId }[] = [
  { pattern: /@chatgpt\b/i, service: "CHATGPT" },
  { pattern: /@gpt\b/i, service: "CHATGPT" },
  { pattern: /@claude\b/i, service: "CLAUDE" },
  { pattern: /@gemini\b/i, service: "GEMINI" },
];

/**
 * 사용자 메시지에서 @멘션을 파싱한다.
 * 대소문자 구분 없음. @all 은 전체 지목.
 */
export function parseMentions(text: string): MentionResult {
  if (/@all\b/i.test(text)) {
    return { targets: "ALL", cleaned: text };
  }

  const targets: ServiceId[] = [];
  for (const { pattern, service } of MENTION_MAP) {
    if (pattern.test(text) && !targets.includes(service)) {
      targets.push(service);
    }
  }

  if (targets.length === 0) return { targets: null, cleaned: text };
  return { targets, cleaned: text };
}
