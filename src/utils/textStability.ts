import { sleep } from "./retry.js";

export interface StabilityOptions {
  getText: () => Promise<string>; // 현재 답변 텍스트를 읽어오는 함수
  isStillGenerating?: () => Promise<boolean>; // Stop 버튼 존재 등 생성 중 여부
  timeoutMs: number; // 최대 대기 시간
  stabilizeMs: number; // 텍스트가 변하지 않아야 하는 안정화 시간
  pollMs?: number; // 폴링 간격 (기본 700ms)
  onStreaming?: (text: string) => void; // 스트리밍 콜백
  shouldAbort?: () => boolean; // 중단 요청 확인
}

export interface StabilityResult {
  text: string;
  timedOut: boolean;
  aborted: boolean;
}

/**
 * 답변 스트리밍이 안정화될 때까지 대기한다.
 * 완료 판단: (Stop 버튼이 사라졌고) 텍스트가 stabilizeMs 동안 변하지 않으면 완료.
 * 최대 timeoutMs 를 넘으면 timedOut=true 로 현재까지의 텍스트를 반환한다.
 */
export async function waitForStableText(opts: StabilityOptions): Promise<StabilityResult> {
  const pollMs = opts.pollMs ?? 700;
  const start = Date.now();

  let lastText = "";
  let lastChangeAt = Date.now();

  while (true) {
    if (opts.shouldAbort?.()) {
      return { text: lastText.trim(), timedOut: false, aborted: true };
    }

    if (Date.now() - start > opts.timeoutMs) {
      return { text: lastText.trim(), timedOut: true, aborted: false };
    }

    let current = "";
    try {
      current = await opts.getText();
    } catch {
      current = lastText;
    }

    if (current !== lastText) {
      lastText = current;
      lastChangeAt = Date.now();
      opts.onStreaming?.(current);
    }

    const generating = opts.isStillGenerating ? await safeBool(opts.isStillGenerating) : false;
    const stableFor = Date.now() - lastChangeAt;

    // 생성이 끝났고(또는 Stop 버튼 없음) 텍스트가 충분히 오래 안정적이면 완료
    if (!generating && stableFor >= opts.stabilizeMs && lastText.trim().length > 0) {
      return { text: lastText.trim(), timedOut: false, aborted: false };
    }

    await sleep(pollMs);
  }
}

async function safeBool(fn: () => Promise<boolean>): Promise<boolean> {
  try {
    return await fn();
  } catch {
    return false;
  }
}
