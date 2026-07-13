// 공용 타입 정의

export type ServiceId = "CHATGPT" | "CLAUDE" | "GEMINI";
export type Speaker = "USER" | ServiceId | "SYSTEM";

export type MessageStatus =
  | "PENDING"
  | "SENDING"
  | "STREAMING"
  | "COMPLETED"
  | "FAILED";

export interface ChatMessage {
  id: string;
  roomId: string;
  speaker: Speaker;
  content: string;
  createdAt: string;
  round: number;
  status: MessageStatus;
  errorMessage?: string;
}

export type ConversationMode = "ROUNDTABLE" | "FREE_DEBATE";

// 참가자(서비스) 실시간 상태
export type ServiceStatus =
  | "READY" // 준비됨
  | "LOGIN_REQUIRED" // 로그인 필요
  | "SENDING" // 메시지 전송 중
  | "GENERATING" // 답변 작성 중
  | "DONE" // 답변 완료
  | "PAUSED" // 일시 정지
  | "ERROR" // 오류 발생
  | "DISCONNECTED"; // 브라우저 연결 끊김

export interface AIHealthStatus {
  service: ServiceId;
  loggedIn: boolean;
  connected: boolean;
  url: string;
  detail?: string;
}

// AI별 역할 프롬프트
export interface RoleConfig {
  chatgpt: string;
  claude: string;
  gemini: string;
  commonRules: string;
}

// 서비스별 설정
export interface ServiceConfig {
  enabled: boolean;
  url: string;
}

export interface AppSettings {
  userName: string;
  roomTitle: string;
  defaultMode: ConversationMode;
  speakingOrder: ServiceId[];
  services: Record<ServiceId, ServiceConfig>;
  roles: RoleConfig;

  // 컨텍스트 제한
  maxContextMessages: number; // 기본 12
  maxContextChars: number; // 기본 24000

  // 타이밍
  responseTimeoutMs: number; // 기본 180000
  stabilizeMs: number; // 기본 3000
  delayBetweenMs: number; // AI 답변 사이 대기

  // 동작 옵션
  allowSendWhileGenerating: boolean;
  autoSave: boolean;
  saveScreenshots: boolean;

  // 자유 토론 모드 제한 (2차)
  freeDebate: {
    maxAiTurnsPerUserMessage: number; // 기본 6
    maxTurnsPerAi: number; // 기본 2
    maxRounds: number; // 기본 2
  };
}

// 오케스트레이터 → 프론트로 전달되는 실시간 이벤트
export type OrchestratorEvent =
  | { type: "SERVICE_STATUS_CHANGED"; service: ServiceId; status: ServiceStatus; detail?: string }
  | { type: "MESSAGE_SENDING"; service: ServiceId }
  | { type: "RESPONSE_STARTED"; service: ServiceId }
  | { type: "RESPONSE_STREAMING"; service: ServiceId }
  | { type: "RESPONSE_COMPLETED"; service: ServiceId; message: ChatMessage }
  | { type: "RESPONSE_FAILED"; service: ServiceId; error: string }
  | { type: "ROUND_COMPLETED"; round: number }
  | { type: "PROGRESS"; text: string }
  | { type: "MESSAGE_ADDED"; message: ChatMessage }
  | { type: "ABORTED" };

export interface Room {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  mode: ConversationMode;
  settings: AppSettings;
  messages: ChatMessage[];
}

export const SERVICE_LABELS: Record<ServiceId, string> = {
  CHATGPT: "ChatGPT",
  CLAUDE: "Claude",
  GEMINI: "Gemini",
};
