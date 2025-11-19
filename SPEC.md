Project Spec Bible: Just Say It (말만 해)

Version: 2.0.0 (SDD Complete)
Last Updated: 2025-05-20
Target: Single-User Personalized MVP
Context: 이 문서는 프로젝트의 '헌법', '요구사항', '기술 계획', '실행 과제'를 모두 포함하는 유일한 진실 공급원(Single Source of Truth)입니다.

Part 1. Constitution (개발 원칙 & 헌법)

AI 에이전트와 개발자는 코드를 작성할 때 반드시 아래 원칙을 준수해야 합니다.

1.1. Code Quality & Style

Language: TypeScript (Strict Mode 필수). any 타입 사용 금지.

Framework: React Native (Expo) + Functional Components (Hooks).

Naming:

Variables/Functions: camelCase (e.g., analyzeAudio)

Components: PascalCase (e.g., MemoCard)

Database Columns: snake_case (e.g., user_id, is_deleted)

Environment Variables: UPPER_SNAKE_CASE (e.g., EXPO_PUBLIC_SUPABASE_URL)

Comments: 복잡한 로직(특히 날짜 계산, 재귀 등)에는 반드시 한글 주석을 첨부한다.

1.2. Error Handling Strategy

Fail Gracefully: 앱은 절대 크래시(Crash)되지 않아야 한다. 에러 발생 시 사용자에게 친절한 Toast 메시지를 띄우고, 내부적으로는 콘솔에 로깅한다.

AI Fallback: Gemini 호출 실패 시, 재시도(Retry) 로직을 1회 수행하고, 실패 시 해당 메모를 UNCLASSIFIED 상태로 저장하여 데이터 유실을 방지한다.

1.3. Project Structure (Atomic Design 변형)

/src
  /components   (UI 컴포넌트)
  /screens      (페이지 단위)
  /services     (API 호출, Supabase, AI 로직)
  /hooks        (커스텀 훅)
  /types        (TypeScript 인터페이스 정의 - types.ts)
  /utils        (날짜 변환, 포맷팅 등 순수 함수)

Part 2. Specification (기능 명세)

2.1. Service Definition

Mission: "내 머릿속의 카오스(음성)를 코스모스(정돈된 데이터)로."

Core Flow: 녹음 -> STT(Whisper) -> LLM 분류(Gemini Pro) -> (Notion | Calendar) 자동 적재.

2.2. User Stories

음성 메모: 사용자는 앱을 켜고 버튼 하나만 눌러 생각나는 모든 것을 말할 수 있어야 한다.

자동 분류: 사용자는 별도의 태그 지정 없이, AI가 알아서 일정/할 일/아이디어로 분류해주길 원한다.

외부 연동:

"내일 3시 미팅"이라고 하면 구글 캘린더에 등록되어야 한다.

"블로그 글 아이디어..."라고 하면 노션에 예쁘게 정리되어야 한다.

데이터 정리: 오디오 파일은 용량 확보를 위해 30일 뒤 자동으로 사라져야 한다.

Part 3. Tech Plan (기술적 구현 계획)

3.1. Tech Stack & Architecture

Frontend: React Native (Expo Router 사용), NativeWind(TailwindCSS)

Backend: Supabase (Database, Auth, Storage, Edge Functions, pg_cron)

AI Core:

STT: OpenAI Whisper large-v3 (via API)

LLM: Google Gemini 1.5 Pro (JSON Mode 필수)

3.2. Data Models (Schema)

A. TypeScript Interface (types/memo.ts)

export type MemoType = 'SCHEDULE' | 'TODO' | 'IDEA' | 'NOTE';
export type MemoStatus = 'UPLOADING' | 'PROCESSING' | 'COMPLETED' | 'SYNCED' | 'FAILED';

export interface Memo {
  id: string;
  user_id: string;
  raw_text: string;        // STT 결과
  summary: string;         // 제목
  content_body?: string;   // 노션용 마크다운 본문
  
  primary_type: MemoType;
  entities: {
    target_date?: string;  // ISO 8601
    location?: string;
    tags?: string[];
    external_id?: string;  // Google Event ID or Notion Page ID
  };
  
  created_at: string;
  status: MemoStatus;
  audio_url?: string | null; // 30일 후 null 처리
}

B. Database Table (memos)
id: uuid (PK)

user_id: uuid (FK -> auth.users)

raw_text: text

summary: text

content_body: text (nullable)

primary_type: text (Check: 'SCHEDULE', 'TODO', ...)

entities: jsonb

status: text

audio_url: text (nullable)

created_at: timestamptz (Default: now())

3.3. AI Logic & Prompt Engineering
Endpoint: Supabase Edge Function analyze-memo

System Prompt (Gemini 1.5 Pro):

"You are a personal secretary. Current Time (KST): {CURRENT_KST_TIME} Task:

Analyze the transcript.

If it's a specific appointment, type is 'SCHEDULE'. Extract date strictly based on KST.

If it's a task/idea, type is 'TODO' or 'IDEA'. Reformat the content into clean Markdown (headers, bullets).

Output JSON only matching the defined Schema."

3.4. Automation (Cron Job)
Schedule: 매일 15:00 UTC (00:00 KST)

Logic: UPDATE memos SET audio_url = NULL WHERE created_at < NOW() - INTERVAL '30 days' 및 Storage 파일 삭제.

Part 4. Task List (실행 과제)
AI는 이 목록을 순서대로 실행하며 체크해야 합니다.

Phase 1: Foundation (기반 구축)
[ ] Init: Expo 프로젝트 생성 (TypeScript 템플릿) 및 Supabase 프로젝트 생성.

[ ] DB: memos 테이블 및 user_integrations 테이블 SQL 작성 및 마이그레이션.

[ ] Auth: Supabase Google Auth 설정 (iOS/Android Client ID 발급).

[ ] UI: 메인 화면 레이아웃 (마이크 버튼, 리스트 뷰) 퍼블리싱 (NativeWind 사용).

Phase 2: The Core (녹음 및 AI 파이프라인)
[ ] Audio: expo-av 활용하여 녹음 기능 구현 (m4a 포맷).

[ ] Storage: Supabase Storage audio-memos 버킷 생성 및 업로드 로직 구현.

[ ] Edge Function: analyze-memo 함수 생성. (OpenAI Whisper + Gemini 호출 로직 작성).

[ ] Integration: 앱에서 업로드 후 Edge Function 호출 -> DB 업데이트 실시간 구독(Realtime) 구현.

Phase 3: External Integrations (외부 연동)
[ ] Setting UI: 노션 API Key, DB ID 입력 화면 및 구글 캘린더 연동 스위치 UI 구현.

[ ] Logic: Gemini 프롬프트 고도화 (Notion Markdown 포맷팅 강화).

[ ] Notion: Edge Function 내 notion-client 추가 및 페이지 생성 로직 구현.

[ ] Calendar: Google Calendar API (insert event) 연동 로직 구현.

Phase 4: Polish & Cleanup (마무리)
[ ] Cron: Supabase 대시보드에서 pg_cron 활성화 및 오디오 삭제 쿼리 스케줄링 등록.

[ ] Error: 네트워크 오프라인 시 예외 처리 (Local Queueing 아이디어 구체화).

[ ] Test: 실제 사용자 음성(한국어)으로 E2E 테스트 진행.

💡 Usage Note for AI Agent
Step 1: Read Part 1 (Constitution) to understand the coding style.

Step 2: Refer to Part 3 (Tech Plan) for architecture decisions.

Step 3: Execute items in Part 4 (Task List) sequentially. Do not jump steps.
