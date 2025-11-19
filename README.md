# Project Spec Bible: Just Say It (말만 해)

Version: 1.2.0
Last Updated: 2025-05-20
Status: Ready for Dev (Personalized)
Key Updates: Notion API Integration, LLM Upgrade (Gemini 1.5 Pro), KST Cron Schedule

---

## 1. 프로젝트 개요 (Overview)

* **서비스명:** Just Say It (말만 해)
* **목표:** 1인 사용자를 위한 초개인화 AI 비서.
* **서비스 정의:** 사용자의 음성을 인식해 **[일정]**은 구글 캘린더로, **[할 일/아이디어/메모]는 노션(Notion)**으로 자동 분류 및 적재하며, 최고 성능의 LLM을 활용해 맥락을 완벽하게 정리하는 서비스.
* **개발 철학:** Spec-Driven Development (SDD) - 고성능 모델을 활용한 Quality-First 접근.

## 2. 시스템 아키텍처 (System Architecture)

### 2.1. Tech Stack Strategy

* **Mobile App:** React Native (Expo)
* **Backend:** Supabase (Auth, DB, Storage, Edge Functions)
* **Integrations:**
    * Google Calendar API (일정 관리)
    * Notion API (지식/할 일 관리)
* **AI Engine (High-End):**
    * **STT:** OpenAI Whisper API (Model: whisper-1 / large-v3) - 한국어 인식률 최적화
    * **LLM:** Google Gemini 1.5 Pro (Not Flash) - 추론 능력 극대화

### 2.2. Data Flow (Router Logic)

* **Auth:** Google 로그인 + Notion API Key 등록.
* **Analyze:** Gemini 1.5 Pro가 텍스트 분석 후 Target Destination 결정.
* **Type == SCHEDULE** -> Google Calendar Sync.
* **Type == TODO | IDEA | NOTE** -> Notion Database Sync.
* **Cleanup:** 매일 자정(KST)에 원본 오디오 삭제.

## 3. 데이터 모델 (Data Models)

### 3.1. Types & Interfaces

```typescript
type MemoStatus = 'UPLOADING' | 'PROCESSING' | 'COMPLETED' | 'SYNCED' | 'FAILED';
type MemoType = 'SCHEDULE' | 'TODO' | 'IDEA' | 'NOTE';

interface Memo {
  id: string;
  user_id: string;

  // Content
  raw_text: string;
  summary: string; // 노션 페이지 제목
  content_body?: string; // 노션 페이지 본문에 들어갈 상세 내용 (Markdown)

  // AI Analysis
  primary_type: MemoType;
  entities: {
    target_date?: string;
    tags?: string[]; // 노션 태그
    external_id?: string; // Google Event ID or Notion Page ID
  };

  // Metadata
  created_at: string;
  status: MemoStatus;
}

// 사용자 설정 (Secrets)
interface UserIntegrations {
  user_id: string;
  google_refresh_token?: string;
  notion_api_key?: string;
  notion_database_id?: string; // 데이터를 쌓을 타겟 DB ID
}
```

### 3.2. Database Schema

* **Table memos:** 메모 데이터 저장.
* **Table user_integrations:** API 키 및 토큰 저장 (Encrypted Column 권장).

## 4. 기능 및 로직 명세 (Functional Logic)

### 4.1. AI Router & Processing (Gemini 1.5 Pro)

* **Role:** "당신은 사용자의 개인 비서이자 노션(Notion) 정리 전문가입니다."
* **Task:**
    * **입력:** STT 텍스트.
    * **판단:** 내용이 '약속/일정'이면 SCHEDULE, 그 외엔 성격에 따라 분류.
    * **가공:**
        * **SCHEDULE:** 날짜/장소 추출.
        * **NOTION:** 본문 내용을 노션 블록 구조(Bullet list, H1, H2 등)로 예쁘게 재구성(Markdown).

### 4.2. Notion 연동 (Knowledge Base)

* **API:** `https://api.notion.com/v1/pages`
* **Mapping Logic:**
    * **Database ID:** 사용자 설정값.
    * **Properties:**
        * **Name (Title):** `memo.summary`
        * **Tags (Multi-select):** `memo.primary_type` (예: Idea, To-Do)
        * **Date (Date):** `entities.target_date` (있을 경우)
    * **Children (본문):**
        * Gemini가 생성한 Markdown 텍스트를 Notion Block 형태로 변환하여 삽입.

### 4.3. 오디오 자동 삭제 (KST Localization)

* **Goal:** 대한민국 표준시(KST) 기준 매일 자정(00:00)에 실행.
* **Calculation:** KST = UTC + 9. 따라서 00:00 KST = 15:00 UTC (전일).
* **Cron Expression:** `0 15 * * *` (매일 15시 0분 UTC에 실행).
* **Query:**

    ```sql
    DELETE FROM storage.objects WHERE bucket_id = 'audio-memos' AND created_at < NOW() - INTERVAL '30 days';
    -- DB 업데이트 로직 병행
    ```

## 5. 화면 구성 (UI Updates)

### 5.1. Screen: Settings (설정)

* **Integration Section:**
    * [G] Google Calendar 연결됨 (Toggle ON)
    * [N] Notion 연결됨 (Toggle ON)
* **Input:** Notion API Key 입력창.
* **Input:** Database ID 입력창 (또는 'DB 검색' 버튼).

### 5.2. Screen: Detail (메모 상세)

* **Action Button (Dynamic):**
    * 타입이 SCHEDULE일 때 -> [📅 구글 캘린더 등록]
    * 타입이 IDEA/TODO일 때 -> [📝 노션 페이지 생성]
* **Preview:**
    * 노션으로 보낼 경우, Gemini가 정리한 Markdown 본문 미리보기 제공. (사용자가 수정 가능)

## 6. API 명세 (Backend)

### 6.1. Edge Functions

| Function Name | Trigger | Description | Key Payload |
| :--- | :--- | :--- | :--- |
| `analyze-memo` | Upload Complete | Whisper(Large-v3) + Gemini 1.5 Pro 실행 | `{ audio_url }` |
| `sync-external` | User Click | 타입에 따라 Google 또는 Notion API 호출 | `{ type: 'GOOGLE' or 'NOTION', memo_id: '...' }` |

## 7. 개발 우선순위 (Priority)

* **Core:** Whisper(large-v3) + Gemini 1.5 Pro 연결.
* **Integration A:** Notion API 연동 (개인 로그 정리가 우선이므로).
* **Integration B:** Google Calendar API 연동.
