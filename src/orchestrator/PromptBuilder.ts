import type { AppSettings, ChatMessage, ServiceId } from "../types/index.js";
import { SERVICE_LABELS } from "../types/index.js";

const ROLE_KEY: Record<ServiceId, keyof AppSettings["roles"]> = {
  CHATGPT: "chatgpt",
  CLAUDE: "claude",
  GEMINI: "gemini",
};

const TRUNCATION_NOTICE =
  "이 대화는 오래 진행되어 일부 초기 발언이 생략되었습니다.\n현재 제공된 최근 대화를 중심으로 답변하세요.";

function speakerLabel(speaker: ChatMessage["speaker"], userName: string): string {
  if (speaker === "USER") return userName || "사용자";
  if (speaker === "SYSTEM") return "시스템";
  return SERVICE_LABELS[speaker as ServiceId];
}

/**
 * PromptBuilder
 * 특정 AI(target)에게 보낼, 공용 대화 기록을 포함한 단일 메시지 텍스트를 구성한다.
 *
 * 우선순위:
 *  1. 시스템 대화 규칙
 *  2. AI별 역할
 *  3. 사용자의 최초 고민/주제
 *  4. 최근 대화 메시지
 *  5. 현재 사용자 메시지
 *
 * 최대 글자 수를 넘으면 오래된 일반 메시지부터 제외한다.
 */
export function buildPrompt(
  target: ServiceId,
  messages: ChatMessage[],
  settings: AppSettings,
): string {
  const userName = settings.userName;
  const targetLabel = SERVICE_LABELS[target];
  const role = settings.roles[ROLE_KEY[target]];

  const header = [
    `당신은 사용자, ChatGPT, Claude, Gemini가 참여하는 공용 대화방에`,
    `${targetLabel} 역할로 참여하고 있습니다.`,
    ``,
    `[참가자]`,
    `- 사용자: 고민과 질문을 이야기하는 사람`,
    `- ChatGPT: 새로운 가능성과 실행 방안을 제안하는 참가자`,
    `- Claude: 논리적인 허점, 위험, 모순을 검토하는 참가자`,
    `- Gemini: 정보를 보완하고 의견을 종합하는 참가자`,
    ``,
    settings.roles.commonRules,
    ``,
    `[${targetLabel}의 역할]`,
    role,
    ``,
  ].join("\n");

  // COMPLETED 상태의 실제 발언만 포함 (실패/시스템 오류 메시지는 제외)
  const usable = messages.filter(
    (m) => m.speaker !== "SYSTEM" && (m.status === "COMPLETED" || m.speaker === "USER"),
  );

  // 최초 주제 = 가장 오래된 사용자 메시지
  const firstUser = usable.find((m) => m.speaker === "USER");

  // 최근 N개
  let recent = usable.slice(-settings.maxContextMessages);

  // 최초 주제가 recent 에 없으면 앞에 붙일 준비
  const topicIncluded = firstUser ? recent.includes(firstUser) : true;

  const renderBlock = (m: ChatMessage) =>
    `${speakerLabel(m.speaker, userName)}:\n${m.content}`;

  const assemble = (list: ChatMessage[], includeTopic: boolean, truncated: boolean): string => {
    const parts: string[] = [header];
    if (includeTopic && firstUser && !list.includes(firstUser)) {
      parts.push(`[대화 주제]`);
      parts.push(renderBlock(firstUser));
      parts.push("");
    }
    if (truncated) {
      parts.push(`[안내] ${TRUNCATION_NOTICE}`);
      parts.push("");
    }
    parts.push(`[지금까지의 대화]`);
    parts.push("");
    parts.push(list.map(renderBlock).join("\n\n"));
    parts.push("");
    parts.push(`이제 ${targetLabel}의 입장에서 자연스럽게 대화에 참여하세요.`);
    return parts.join("\n");
  };

  // 글자 수 제한을 넘으면 오래된 일반 메시지부터 제외
  let truncated = usable.length > recent.length;
  let prompt = assemble(recent, !topicIncluded, truncated);

  while (prompt.length > settings.maxContextChars && recent.length > 1) {
    recent = recent.slice(1); // 가장 오래된 것 제거
    truncated = true;
    prompt = assemble(recent, !!firstUser && !recent.includes(firstUser), truncated);
  }

  return prompt;
}
