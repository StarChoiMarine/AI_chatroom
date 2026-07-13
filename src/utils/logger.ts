import fs from "node:fs";
import path from "node:path";

type Level = "INFO" | "WARN" | "ERROR" | "DEBUG";

const LOG_DIR = path.resolve("logs");
const LOG_FILE = path.join(LOG_DIR, "app.log");

// DEBUG 모드에서만 대화 본문 등 상세 내용을 파일에 기록한다.
const DEBUG = process.env.DEBUG === "1" || process.env.DEBUG === "true";

function ensureDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

function write(level: Level, msg: string) {
  const line = `[${new Date().toISOString()}] [${level}] ${msg}`;

  const color =
    level === "ERROR" ? "\x1b[31m" : level === "WARN" ? "\x1b[33m" : level === "DEBUG" ? "\x1b[90m" : "\x1b[36m";
  // 콘솔 출력
  if (level !== "DEBUG" || DEBUG) {
    console.log(`${color}[${level}]\x1b[0m ${msg}`);
  }

  // 파일 출력 (DEBUG 레벨은 DEBUG 모드에서만 파일 기록)
  if (level !== "DEBUG" || DEBUG) {
    try {
      ensureDir();
      fs.appendFileSync(LOG_FILE, line + "\n", "utf8");
    } catch {
      /* 로그 파일 기록 실패는 무시 */
    }
  }
}

export const logger = {
  info: (msg: string) => write("INFO", msg),
  warn: (msg: string) => write("WARN", msg),
  error: (msg: string) => write("ERROR", msg),
  debug: (msg: string) => write("DEBUG", msg),
  isDebug: () => DEBUG,
};
