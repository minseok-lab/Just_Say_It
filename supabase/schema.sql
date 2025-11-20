-- 1. UUID 확장 기능 켜기
create extension if not exists "uuid-ossp";

-- 2. Memos 테이블 생성 (보완됨)
create table public.memos (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null, -- 유저 삭제시 데이터 자동 삭제
  raw_text text,
  summary text,
  content_body text,
  
  -- 입력값 제한 (오타 방지)
  primary_type text check (primary_type in ('SCHEDULE', 'TODO', 'IDEA', 'NOTE')),
  
  -- 빈 객체로 초기화하여 에러 방지
  entities jsonb default '{}'::jsonb, 
  
  -- 상태값 제한 및 기본값 설정
  status text default 'UPLOADING' check (status in ('UPLOADING', 'PROCESSING', 'COMPLETED', 'SYNCED', 'FAILED')),
  
  audio_url text,
  created_at timestamp with time zone default now()
);

-- 3. Memos 보안 정책 (RLS)
alter table public.memos enable row level security;

create policy "Users can view their own memos" 
  on public.memos for select using (auth.uid() = user_id);

create policy "Users can insert their own memos" 
  on public.memos for insert with check (auth.uid() = user_id);

create policy "Users can update their own memos" 
  on public.memos for update using (auth.uid() = user_id);

create policy "Users can delete their own memos" 
  on public.memos for delete using (auth.uid() = user_id);


-- 4. User Integrations 테이블 생성 (보완됨)
create table public.user_integrations (
  user_id uuid references auth.users(id) on delete cascade primary key, -- 유저 삭제시 자동 삭제
  google_refresh_token text,
  notion_api_key text,
  notion_database_id text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 5. Integrations 보안 정책 (RLS)
alter table public.user_integrations enable row level security;

create policy "Users can manage their own integrations"
  on public.user_integrations for all using (auth.uid() = user_id);


-- 6. Storage 버킷 생성 (SQL로 생성 시도)
-- 참고: 권한 문제로 SQL에서 실패할 경우, 대시보드 'Storage' 메뉴에서 'audio-memos' 버킷을 직접 만들어주세요.
insert into storage.buckets (id, name, public)
values ('audio-memos', 'audio-memos', false)
on conflict (id) do nothing; -- 이미 있으면 패스

-- 7. Storage 보안 정책
-- 내 폴더(user_id)가 아니라 내 파일(owner) 기준으로 권한 부여
create policy "Users can upload audio"
  on storage.objects for insert
  with check ( bucket_id = 'audio-memos' and auth.uid() = owner );

create policy "Users can view their own audio"
  on storage.objects for select
  using ( bucket_id = 'audio-memos' and auth.uid() = owner );

create policy "Users can delete their own audio"
  on storage.objects for delete
  using ( bucket_id = 'audio-memos' and auth.uid() = owner );