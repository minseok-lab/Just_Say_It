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

export interface UserIntegrations {
    user_id: string;
    google_refresh_token?: string;
    notion_api_key?: string;
    notion_database_id?: string; // 데이터를 쌓을 타겟 DB ID
}
