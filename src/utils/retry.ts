import { logger } from "./logger.js";

export interface RetryOptions {
  retries?: number; // 최대 재시도 횟수 (기본 3)
  delays?: number[]; // 재시도 간격(ms). 기본 [1000, 2000, 4000]
  label?: string;
  onAttemptFail?: (err: unknown, attempt: number) => void;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 제한적 재시도. 즉시 종료하지 않고 지정된 간격으로 재시도한다.
 * 로그인 만료/CAPTCHA 등 사용자 개입이 필요한 오류는 호출부에서 던지지 않고
 * 별도로 처리하므로, 여기서는 일시적 실패만 재시도한다.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const retries = opts.retries ?? 3;
  const delays = opts.delays ?? [1000, 2000, 4000];
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      opts.onAttemptFail?.(err, attempt);
      if (attempt < retries) {
        const wait = delays[Math.min(attempt, delays.length - 1)];
        logger.warn(
          `${opts.label ?? "작업"} 실패 (시도 ${attempt + 1}/${retries + 1}), ${wait}ms 후 재시도: ${
            (err as Error)?.message ?? err
          }`,
        );
        await sleep(wait);
      }
    }
  }
  throw lastErr;
}
