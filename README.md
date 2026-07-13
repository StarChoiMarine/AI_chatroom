# AI 원탁회의 (로컬 4인 AI 대화방)

사용자 1명 + ChatGPT · Claude · Gemini 3개의 AI가 하나의 공용 대화방에서 **서로의 발언을 읽으며 순차적으로 대화**하는 로컬 전용 프로그램입니다.

- **API 키를 사용하지 않습니다.** 사용자가 각 웹서비스에 직접 로그인하고, Playwright가 실제 브라우저 화면을 조작해 메시지를 보내고 답변을 수집합니다.
- 오직 개인 컴퓨터(localhost)에서만 실행되며 외부 배포/서버 운영을 하지 않습니다.
- CAPTCHA·봇 탐지 우회, 로그인 자동 입력, 비밀번호 저장 기능은 없습니다.

> Chrome/Google 로그인이 Playwright 자동화 브라우저를 막는 경우가 있어, `extension/` 폴더에 **브라우저 확장프로그램 버전**도 포함되어 있습니다. API 비용 없이 계속 쓰려면 확장프로그램 방식을 권장합니다.

---

## 0. 브라우저 확장프로그램 방식(권장)

이 방식은 별도 자동화 Chrome을 띄우지 않고, 사용자가 평소 로그인한 Chrome 세션에서 동작합니다.

1. Chrome에서 `chrome://extensions` 열기
2. 오른쪽 위 **개발자 모드** 켜기
3. **압축해제된 확장 프로그램을 로드합니다** 클릭
4. 이 프로젝트의 `extension/` 폴더 선택
5. 툴바의 **AI Roundtable** 아이콘 클릭
6. ChatGPT / Claude / Gemini 탭이 열리면 평소처럼 직접 로그인
7. 확장프로그램 화면에서 **로그인 상태 확인** 클릭 후 대화 시작

확장프로그램 버전의 특징:

- API 키와 API 비용이 필요 없습니다.
- Google OAuth가 Playwright 자동화 브라우저를 차단하는 문제를 피합니다.
- 로그인 쿠키를 프로젝트 폴더에 복사하지 않고, 현재 Chrome 프로필의 세션을 사용합니다.
- 대화 기록은 Chrome 확장프로그램 저장소(`chrome.storage.local`)에 저장됩니다.

주의:

- 각 AI 웹사이트 DOM 구조가 바뀌면 `extension/content-script.js`의 선택자를 수정해야 합니다.
- 확장프로그램은 ChatGPT/Claude/Gemini 페이지를 조작할 권한을 갖습니다. 신뢰하는 코드만 설치하세요.

---

## 기존 Playwright 로컬 서버 방식

---

## 1. Node.js 설치

macOS 기준. 터미널에서 확인:

```bash
node -v   # v18 이상 권장 (개발은 v20+/v24 확인됨)
npm -v
```

없다면 [nodejs.org](https://nodejs.org) 에서 LTS 버전을 설치하거나 Homebrew 사용:

```bash
brew install node
```

## 2. Google Chrome 설치 확인

이 프로그램은 시스템에 설치된 **Google Chrome** 을 사용합니다(`channel: "chrome"`).

```bash
ls "/Applications/Google Chrome.app"   # 존재하면 OK
```

없다면 [google.com/chrome](https://www.google.com/chrome/) 에서 설치하세요.

## 3. 프로젝트 설치

```bash
cd ai-roundtable
npm install
```

## 4. Playwright(Chrome 채널) 설치

```bash
npm run setup    # = playwright install chrome
```

## 5. 실행

```bash
npm run dev      # 개발 모드(파일 변경 감시)
# 또는
npm start
```

실행되면:

1. 로컬 서버가 `http://localhost:5173` 에 뜹니다. 브라우저에서 이 주소를 여세요.
2. 자동화 전용 Chrome 창이 뜨고 ChatGPT / Claude / Gemini 탭이 각각 열립니다.
3. 각 서비스 로그인 상태를 확인합니다.

> 포트를 바꾸려면 `PORT=6000 npm start` 처럼 실행하세요.

## 6. 최초 로그인 방법

처음에는 세 서비스 모두 **"로그인 필요"** 로 표시됩니다.

1. 자동으로 열린 **자동화 전용 Chrome 창**에서 각 탭(ChatGPT, Claude, Gemini)에 **직접 로그인**합니다. (평소 쓰는 Chrome 프로필과 분리된 전용 프로필입니다.)
2. 로그인 후, 로컬 웹 화면 상단의 **[로그인 상태 확인]** 버튼을 누릅니다.
3. 참가자 상태가 **"준비됨"** 으로 바뀌면 대화를 시작할 수 있습니다.

로그인 세션(쿠키)은 `browser-profile/` 폴더에 저장되어 **다음 실행에도 유지**됩니다.

## 7. 로그인 상태 확인

- 상단 **[로그인 상태 확인]** 버튼: 세 서비스 모두 재확인
- 실패한 메시지의 **[로그인 상태 확인]** 버튼: 해당 서비스만 재확인

## 8. 새 대화 시작

상단 **[새 대화]** → 두 가지 선택:

- **로컬 대화 기록만 초기화**: 로컬 대화방만 비웁니다(웹 대화는 그대로).
- **AI 웹사이트에서도 새 대화 생성**: 각 서비스 웹에서도 새 대화를 시작합니다.

이전 대화는 `data/rooms/` 에 별도 파일로 보관됩니다.

## 9. AI 지목 방법

메시지 안에 멘션을 넣으면 특정 AI만 답합니다(대소문자 무관):

```
@ChatGPT (또는 @GPT)   → ChatGPT만
@Claude                → Claude만
@Gemini                → Gemini만
@all                   → 셋 다 순서대로
```

멘션이 없으면 기본 모드(원탁회의: ChatGPT → Claude → Gemini)로 동작합니다.

- **Enter** 전송 / **Shift+Enter** 줄바꿈

## 10. 오류 발생 시 해결 방법

| 증상 | 해결 |
|---|---|
| 로그인 만료 | 자동화 Chrome에서 다시 로그인 → [로그인 상태 확인] |
| 입력창/답변 영역을 못 찾음 | 실패 메시지의 [탭 열기] 또는 [다시 시도]. 계속되면 아래 11번 선택자 수정 |
| 답변 시간 초과 | 실패 메시지의 [다시 시도], 또는 다른 AL로 계속 진행 |
| 탭이 닫힘 | [탭 열기] 로 재연결 |
| 특정 AI만 실패 | 이미 받은 답변은 유지됩니다. 실패 메시지의 [다시 시도] 로 그 AI만 재시도 |
| 전체를 멈추고 싶음 | 입력창 위 [전체 중단] |

일부 AI가 실패해도 **전체 프로그램은 종료되지 않습니다.**

## 11. 선택자(Selector) 변경 시 수정할 파일

각 사이트의 DOM 구조가 바뀌어 입력창/전송/답변을 못 찾을 때는 **Adapter가 아니라 선택자 파일만** 수정하면 됩니다:

```
src/selectors/chatgpt.selectors.ts
src/selectors/claude.selectors.ts
src/selectors/gemini.selectors.ts
```

각 항목은 "위에서부터 순서대로 시도"하는 후보 배열입니다. 새 선택자를 배열 맨 앞에 추가하세요.

## 12. 대화 데이터 저장 위치

```
data/rooms/<roomId>.json    # 대화방별 메시지 + 설정
```

- Markdown/JSON 내보내기: 설정 모달의 [Markdown 내보내기] / [JSON 내보내기]

## 13. 브라우저 프로필 삭제 및 초기화

로그인이 꼬이거나 완전히 초기화하려면 프로그램 종료 후:

```bash
rm -rf browser-profile/   # 로그인 세션 전부 삭제 → 다음 실행 시 재로그인
```

## 14. Git에 올리면 안 되는 파일

`.gitignore` 에 이미 지정되어 있습니다. **절대 커밋 금지:**

```
browser-profile/   # 로그인 쿠키/세션
data/              # 대화 내용
logs/              # 로그 및 스크린샷(대화 포함 가능)
.env
```

## 15. 프로그램 종료 방법

- 서버를 띄운 터미널에서 **Ctrl + C**
- 자동화 Chrome 창은 함께 닫힙니다.

---

## 프로젝트 구조

```
src/
├── index.ts                     # 진입점: 서버·브라우저·오케스트레이터 조립
├── server.ts                    # Express REST API
├── orchestrator/                # 대화 흐름 제어
│   ├── ConversationOrchestrator.ts
│   ├── PromptBuilder.ts          # 공용 대화 기록 → 각 AI용 프롬프트
│   └── MentionParser.ts          # @지목 파싱
├── browser/                     # Playwright 관리
│   ├── BrowserManager.ts         # Persistent Chrome
│   └── PageRegistry.ts           # 서비스별 탭 관리
├── adapters/                    # 사이트별 DOM 로직
│   ├── BaseAIAdapter.ts
│   ├── ChatGPTAdapter.ts / ClaudeAdapter.ts / GeminiAdapter.ts
├── selectors/                   # 사이트별 선택자(구조 변경 시 여기만 수정)
├── storage/                     # 대화 저장(JSON, SQLite 교체 가능)
├── websocket/SocketManager.ts   # 실시간 상태 전달
├── config/defaults.ts           # 기본 설정·역할 프롬프트
├── types/ · utils/
└── public/                      # 프론트엔드(index.html, app.js, style.css)
```

## 동작 흐름

```
사용자 입력
 → PromptBuilder가 공용 대화 기록 구성
 → ChatGPTAdapter가 ChatGPT 웹에 입력 → 답변 수집
 → 답변 포함 기록을 ClaudeAdapter가 Claude 웹에 입력 → 답변 수집
 → 앞선 모든 답변을 GeminiAdapter가 Gemini 웹에 입력 → 답변 수집
 → 로컬 그룹 채팅 화면에 순서대로 표시 + data/ 에 저장
```

## 주의 / 한계

- 웹사이트 구조는 수시로 바뀝니다. 자동화가 실패하면 자동화 Chrome 창에서 **직접 조작**한 뒤 [다시 시도]/[탭 열기] 로 재개하세요.
- 각 서비스의 이용약관을 준수하세요. 자동화 차단을 우회하지 않습니다.
- 개인용 로컬 도구입니다. 외부 공유/배포를 전제로 만들어지지 않았습니다.
