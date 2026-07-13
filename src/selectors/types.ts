// 서비스별 선택자 스키마.
// 사이트 구조가 바뀌면 Adapter가 아니라 이 파일들만 수정하면 된다.
// 각 항목은 "위에서부터 순서대로 시도"하는 후보 선택자 배열이다.

export interface ServiceSelectors {
  // 로그인 여부 판단에 사용
  loggedInIndicators: string[]; // 하나라도 보이면 로그인된 것으로 간주 (보통 입력창)
  loginRequiredIndicators: string[]; // 하나라도 보이면 로그인 필요

  // 입력창 후보 (data-testid → textarea → contenteditable → placeholder/aria-label 순)
  input: string[];

  // 전송 버튼 후보
  sendButton: string[];

  // 생성 중지(Stop) 버튼 후보 — 존재하면 아직 생성 중
  stopButton: string[];

  // AI 답변 메시지 블록 후보 (마지막 요소가 최신 답변)
  assistantMessage: string[];

  // 새 대화 시작 버튼/링크 후보
  newChat: string[];
}
