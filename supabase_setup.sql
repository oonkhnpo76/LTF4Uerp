-- ============================================================
-- 엘티에프포유 ERP : 팀 공유 데이터베이스 설정 스크립트
-- Supabase 대시보드 > SQL Editor 에서 이 파일 내용을 전체 복사해서 실행하세요.
-- ============================================================

-- 1) 데이터 저장용 테이블 생성
--    ERP 화면의 각 데이터 묶음(재고, 매출, TODO 등)을 key-value 형태로 저장합니다.
--    key   : 예) 'erp:inventory', 'erp:sales', 'erp:todos2' ...
--    value : 해당 데이터의 JSON 문자열
create table if not exists erp_data (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- 2) 행 수준 보안(RLS) 활성화 + 공개 읽기/쓰기 정책
--    같은 링크(anon key)를 아는 팀원이라면 누구나 읽고 쓸 수 있도록 설정합니다.
--    (사내용으로만 공유한다는 전제. 더 강한 보안이 필요하면 Supabase Auth 로그인을
--     추가하고 정책을 auth.uid() 기준으로 바꾸는 것을 권장합니다.)
alter table erp_data enable row level security;

drop policy if exists "erp_data_public_select" on erp_data;
create policy "erp_data_public_select" on erp_data
  for select using (true);

drop policy if exists "erp_data_public_insert" on erp_data;
create policy "erp_data_public_insert" on erp_data
  for insert with check (true);

drop policy if exists "erp_data_public_update" on erp_data;
create policy "erp_data_public_update" on erp_data
  for update using (true) with check (true);

-- 3) Realtime(실시간 동기화) 활성화
--    한 사람이 데이터를 바꾸면 다른 팀원 화면에도 즉시 반영되도록 설정합니다.
alter publication supabase_realtime add table erp_data;

-- 완료! 이제 .env 파일에 이 프로젝트의 URL과 anon key를 넣고 앱을 배포하면
-- 모든 팀원이 같은 데이터를 실시간으로 공유해서 보게 됩니다.
