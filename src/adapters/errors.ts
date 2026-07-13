// 사용자 개입이 필요한 오류(자동 재시도하지 않음)
export class LoginRequiredError extends Error {
  constructor(service: string) {
    super(`${service} 로그인이 필요합니다.`);
    this.name = "LoginRequiredError";
  }
}

export class SelectorNotFoundError extends Error {
  triedSelectors: string[];
  constructor(service: string, kind: string, tried: string[]) {
    super(`${service} 페이지에서 ${kind} 요소를 찾지 못했습니다.`);
    this.name = "SelectorNotFoundError";
    this.triedSelectors = tried;
  }
}

export class ResponseTimeoutError extends Error {
  constructor(service: string) {
    super(`${service}의 답변 시간이 초과되었습니다.`);
    this.name = "ResponseTimeoutError";
  }
}

export class AbortedError extends Error {
  constructor() {
    super("사용자에 의해 중단되었습니다.");
    this.name = "AbortedError";
  }
}
