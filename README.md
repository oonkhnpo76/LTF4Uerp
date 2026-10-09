# 엘티에프포유 ERP — 팀 공유(실시간 동기화) 버전

이 버전은 Supabase(무료 클라우드 데이터베이스)를 연결해서, 팀원 누구든 접속해도
**같은 데이터**를 보고, 한 사람이 입력하면 다른 사람 화면에도 **실시간으로** 반영됩니다.
(이전의 "브라우저에만 저장" 버전과 다른 점입니다.)

## 0. 전체 흐름
1. Supabase에서 무료 프로젝트 만들기 → SQL 실행
2. 이 프로젝트를 GitHub에 올리기
3. Vercel에 배포하면서 Supabase 키 2개를 환경변수로 등록
4. 배포된 링크를 Notion에 임베드 → 팀원들이 접속

## 1. Supabase 설정 (5분)
1. https://supabase.com 접속 → 무료 계정 생성 → "New Project" 생성 (이름/비밀번호는 자유롭게)
2. 프로젝트가 생성되면 왼쪽 메뉴 **SQL Editor** 클릭 → "New query"
3. 이 폴더의 `supabase_setup.sql` 파일 내용을 전체 복사해서 붙여넣고 **Run** 클릭
   - `erp_data` 테이블이 생성되고, 모두가 읽고 쓸 수 있는 권한 설정 + 실시간 동기화가 켜집니다.
4. 왼쪽 메뉴 **Project Settings → API** 로 이동해서 다음 두 값을 복사해둡니다.
   - `Project URL` (예: `https://xxxx.supabase.co`)
   - `anon public` 키 (긴 문자열)

## 2. 로컬에서 테스트 (선택)
```bash
npm install
cp .env.example .env
# .env 파일을 열어서 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 값을 위에서 복사한 값으로 채우기
npm run dev
```
브라우저 2개(또는 시크릿창)로 동시에 열어서, 한쪽에서 입력하면 다른 쪽에 실시간으로 반영되는지 확인해보세요.

## 3. Vercel에 배포하기
1. 이 프로젝트 폴더를 GitHub 저장소로 업로드 (GitHub Desktop 또는 `git push` 사용)
2. https://vercel.com 에서 "Add New Project" → 방금 올린 GitHub 저장소 선택
3. "Environment Variables" 항목에 아래 2개를 추가:
   - `VITE_SUPABASE_URL` = (1단계에서 복사한 Project URL)
   - `VITE_SUPABASE_ANON_KEY` = (1단계에서 복사한 anon public 키)
4. Deploy 클릭 → 몇 분 후 `https://프로젝트명.vercel.app` 같은 링크가 생성됩니다.

## 4. Notion에 공유하기
Notion 페이지에서 `/embed` 입력 → 3단계에서 받은 Vercel 링크 붙여넣기.
팀원들은 Notion 페이지만 열면 ERP 화면을 바로 볼 수 있고, 수정도 그 자리에서 가능합니다.

## 참고 — 데이터는 어디에 저장되나요?
- 화면의 재고/매출/TODO 등 모든 데이터는 브라우저가 아니라 **Supabase 데이터베이스**에 저장됩니다.
- 누가 접속하든 같은 데이터베이스를 보기 때문에, 팀원 전체가 동일한 최신 데이터를 보게 됩니다.
- 왼쪽 사이드바에 "팀 공유 데이터 연결됨" 표시가 뜨면 정상 연결된 상태입니다.
  (환경변수가 비어 있으면 "이 브라우저에만 저장 중"으로 표시되고, 예전처럼 로컬에만 저장됩니다.)

## 보안 관련 참고사항
현재 설정은 "이 anon key를 아는 사람은 누구나 읽고 쓸 수 있음" 수준의 간단한 공유 방식입니다.
사내 팀원들끼리만 링크를 공유한다면 문제없지만, 더 엄격한 접근 제어(로그인 필요 등)가
필요하시면 말씀해주세요 — Supabase Auth를 추가해서 로그인한 사람만 접근하도록 업그레이드할 수 있습니다.
