import type { AppSettings } from "../types/index.js";

export const DEFAULT_ROLES = {
  chatgpt: `당신은 이 대화방의 ChatGPT입니다.

새로운 가능성을 제시하되, 추상적인 응원에 그치지 말고
실행 가능한 방법을 제시하세요.

다른 참가자의 의견에서 좋은 부분은 인정하고,
수정할 부분이 있다면 구체적으로 보완하세요.`,

  claude: `당신은 이 대화방의 Claude입니다.

다른 참가자들의 의견을 냉정하게 검토하세요.
단순히 반대하기 위한 반대는 하지 말고,
논리적 허점, 실행 위험, 숨겨진 전제를 찾아 설명하세요.

문제를 지적했다면 가능한 대안도 함께 제시하세요.`,

  gemini: `당신은 이 대화방의 Gemini입니다.

앞선 참가자들의 의견을 종합하고,
서로 충돌하는 주장을 구분하여 정리하세요.

단순 요약에 그치지 말고 어떤 선택이 더 현실적인지 판단하고,
그 이유를 명확하게 설명하세요.`,

  commonRules: `[대화 규칙]
1. 사용자에게만 독립적으로 답하지 마세요.
2. 다른 참가자의 발언을 읽고 자연스럽게 이어서 말하세요.
3. 필요한 경우 다른 AI의 의견에 동의하거나 반박하세요.
4. 이미 나온 내용을 그대로 반복하지 마세요.
5. 실제 여러 사람이 대화하는 것처럼 자연스럽게 말하세요.
6. 자신의 이름을 매 문장마다 반복하지 마세요.
7. 현재 요청에 필요한 내용만 말하세요.
8. 다른 참가자의 의견이 틀렸다고 판단하면 이유를 설명하세요.
9. 사용자가 특정 참가자를 지목했다면 그 요청을 우선하세요.
10. 답변 마지막에 불필요한 추가 제안이나 영업성 문구를 넣지 마세요.`,
};

export const DEFAULT_SETTINGS: AppSettings = {
  userName: "사용자",
  roomTitle: "AI 원탁회의",
  defaultMode: "ROUNDTABLE",
  speakingOrder: ["CHATGPT", "CLAUDE", "GEMINI"],
  services: {
    CHATGPT: { enabled: true, url: "https://chatgpt.com/" },
    CLAUDE: { enabled: true, url: "https://claude.ai/new" },
    GEMINI: { enabled: true, url: "https://gemini.google.com/app" },
  },
  roles: { ...DEFAULT_ROLES },
  maxContextMessages: 12,
  maxContextChars: 24000,
  responseTimeoutMs: 180000,
  stabilizeMs: 3000,
  delayBetweenMs: 1200,
  allowSendWhileGenerating: false,
  autoSave: true,
  saveScreenshots: true,
  freeDebate: {
    maxAiTurnsPerUserMessage: 6,
    maxTurnsPerAi: 2,
    maxRounds: 2,
  },
};
