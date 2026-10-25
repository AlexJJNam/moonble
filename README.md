# Moonble 회원가입 1차 작업

작업 히스토리: [2026-10-13 초기 인증·배포 설정](docs/2026-10-13_SETUP_HISTORY.md)

## Git 브랜치와 Cloudflare Git 연동

- 작업 브랜치: `develop`. Cloudflare 미리보기에서 검증.
- 운영 브랜치: `main`. 사용자 승인 후 검증된 변경만 반영.
- Cloudflare Pages Preview 빌드 명령: `npm run build`, 출력 폴더: `dist`, Root directory는 기본값.
- Preview Branch control: Custom branches의 Include에 `develop`만 지정, Exclude는 비움.
- 현재 Production은 기존 정적 main을 배포하므로 빌드 명령 `exit 0`, 출력 폴더 `.`. 기존 사이트 `https://moonble.pages.dev` 배포 성공을 확인함.
- 회원가입 변경을 main에 승인 반영할 때는 Production 빌드도 `npm run build` / `dist`로 바꾸고 운영용 인증 환경변수를 별도로 설정해야 함. 현재 main에는 회원가입 변경을 반영하지 않음.
- Cloudflare의 develop/Preview 환경변수에 `VITE_SUPABASE_URL`과 `VITE_SUPABASE_PUBLISHABLE_KEY`를 설정해야 실제 인증이 활성화됨. 공개용 키만 사용. 로컬 `.env`는 커밋하지 않음.
- Preview 환경에 두 공개용 인증 변수를 입력 완료. 값 자체는 저장소 문서에 기록하지 않음.
- develop Push로 자동 배포가 시작되면 빌드 로그와 실제 페이지를 확인하고, 프리뷰의 `/login.html` 주소를 Supabase Redirect URLs에 추가. 실제 회원가입·메일·두 계정 권한 검증은 이후 진행.
- 회원가입 전용 파일은 저장소 최상위의 `login.html`, `src/`, `database/`에 배치.
- 원격 main의 기존 모바일 질문 입력창 여백 수정을 보존. 기존 다른 정적 페이지·에셋도 빌드 결과에 복사하여 경로를 유지.
- GitHub에 개발 코드가 올라가는 것과 Cloudflare 배포 설정 완료는 별개임.

## 구성

- `index.html`, `src/entry.jsx`: 로그인 상태와 첫 프로필 입력 여부를 확인하는 가벼운 진입점.
- `solve.html`: 기존 Moonble 문제풀이·개요·성취도 화면. 문제지 목록에서 선택한 범위를 풀이.
- `login.html`, `signup.html`, `src/login.jsx`: 기존 그라데이션·카드 디자인을 유지한 독립 로그인·회원가입 화면.
- `src/account.jsx`: 첫 접속·홈 직접 접속 시 세션을 확인하고 미로그인 사용자는 로그인 화면으로 이동. 로그아웃·세션 해제 시에도 로그인 화면으로 이동.
- `prd.html`, `src/prd/`: 기존 Moonble PRD 목록·프로젝트·6단계 작성·버전 관리 화면. 로그인 후 기본 진입점이며 문서는 사용자별 브라우저 저장 공간에 저장.
- `src/profile.js`, `src/prd/profile-form.jsx`: 첫 로그인 때 이름·회사명을 필수로 받고 Supabase 사용자 메타데이터에 저장. 내 정보 수정에서 같은 항목을 변경.
- `quiz.html`, `src/quiz-library.jsx`: 기본·심화·전체 랜덤 문제지를 카드로 보여주고 선택 시 기존 문제 풀이 화면으로 이동.
- `account.html`, `src/account-page.jsx`: 프로필, 계정별 로컬 데이터, 개인정보 요청과 로그아웃을 관리하는 공통 계정 화면.
- `src/supabase.js`: Supabase 공식 클라이언트로 인증·세션 관리. 비밀번호를 자체 저장하지 않음.
- `database/001_profiles.sql`: 최소 프로필, RLS, 가입 트리거 및 기존 계정 프로필 복구.
- `src/profile-avatar.js`, `database/008_profile_avatars.sql`: JPG·PNG 프로필 사진을 비공개 Storage에 저장. 원본은 최대 20MB, 저장 이미지는 최대 512px 정사각형으로 변환하며 Auth 메타데이터에는 파일 경로만 기록. 회원 탈퇴 전 Storage 파일을 삭제.

## 설정 및 빌드

1. Supabase Free 개발 프로젝트 생성. 결제수단·유료 옵션 등록 금지.
2. 개발 프로젝트 SQL Editor에서 `database/001_profiles.sql`, `database/002_delete_account.sql` 순서로 실행.
3. 공유 문제 기능을 사용할 때는 `database/003_quiz_banks_and_shares.sql`부터 번호 순서대로 적용. 공유 순위 통계 변경은 `database/007_quiz_share_score_analytics.sql`을 `006` 다음 실행. 프로필 사진은 `database/008_profile_avatars.sql`로 비공개 버킷과 본인 폴더 접근 정책을 적용.
4. 이메일·비밀번호 인증과 이메일 확인 설정 점검. Site URL과 Redirect 허용 주소에 실제 프리뷰의 `login.html` 주소 설정. localhost 사용하지 않음.
5. `.env.example`을 `.env`로 복사하여 프로젝트 URL과 **Publishable Key**만 입력. 비밀키 사용 금지. `.env` 커밋 금지.
6. 이 폴더에서 `npm ci`, `npm run build` 실행. 서버는 실행하지 않음.
7. `dist` 폴더 내용을 호스팅에 업로드하고 클라우드 URL로 검증. `.env`를 바꾸면 다시 빌드.

값을 입력하지 않아도 빌드와 기존 페이지 사용은 가능하며, 인증 요청은 비활성화됨.
React와 Supabase는 빌드에 포함되고 기존 D3·폰트·Google Analytics 외부 로드는 유지됨.

## 현재 한계

- Supabase 프로젝트 생성·SQL 적용·실제 가입·클라우드 배포는 사용자 설정 후 검증해야 함.
- Supabase 기본 SMTP는 프로젝트 팀원 이메일만 발송 가능. 임의 실사용자 대상 이메일 확인·비밀번호 재설정은 별도 SMTP 설정 필요. 공개 전에 무료 조건과 발송 한도를 확인할 것.
- 회원 탈퇴는 현재 기기의 계정별 로컬 데이터만 함께 삭제함. 다른 기기에 남은 브라우저 데이터는 해당 기기에서 직접 삭제해야 함.
- PRD 문서·프로젝트는 Supabase 사용자 ID별 브라우저 localStorage에 저장됨. 다른 계정과 키를 분리하지만 다른 기기와 동기화되지 않음.
- 문제풀이 기록·커스텀 문제는 Supabase 사용자 ID별 브라우저 localStorage에 저장됨. 기존 공용 키의 데이터는 배포 후 처음 접속한 로그인 사용자에게 한 번 이전되며 다른 계정과는 분리됨. 클라우드 저장과 기기 간 동기화는 이번 범위에 없음.
- 홈은 세션 확인 전 콘텐츠를 숨겨 미로그인 화면 노출을 방지함. 이는 브라우저의 화면 진입 제어이며 정적 HTML 자체에 대한 서버 접근 제한은 아님. 회원 데이터 권한은 RLS로 통제.
- 프로필은 Auth 계정 생성 시 만들어지므로 이메일 인증 완료 전에도 행이 있을 수 있음. 행 존재를 인증 성공으로 판단하지 않음.

## 클라우드 검증 목록

- 회원가입 후 메일 확인 대기와 실제 세션 생성 구분
- 인증 링크 만료·가입 중복·오류·네트워크 단절 처리
- 로그인 후 기존 페이지 복귀, 새로고침·다른 탭의 세션 상태 반영
- 비밀번호 재설정 후 새 비밀번호 로그인, 로그아웃
- 기존 퀴즈·채점·기록·CSV·구글 시트 가져오기·테마·모바일 메뉴 동작
- 계정 A의 JWT로 계정 B의 profiles 행 조회 시 빈 결과, INSERT 시 권한 거부 확인
- 비로그인 profiles 접근 차단, UPDATE/DELETE 권한 없음 확인
- Free/Billing 상태, Redirect 허용 목록, 개발·운영 데이터 분리 확인

공식 문서: https://supabase.com/docs/guides/auth/passwords · https://supabase.com/docs/guides/auth/auth-smtp

## 2026-10-13 구현 및 사전 검증 결과

- React 인증 UI, 계정 메뉴, Supabase 클라이언트 연결 코드, 프로필 SQL 작성 완료.
- `npm run build` 성공. 업로드 결과물은 `dist/`. 현재 결과물에는 실제 Supabase 프로젝트 설정이 없어 인증 요청은 비활성화됨.
- 빌드 결과의 기존 인라인 JavaScript와 CSS가 소스와 동일함을 확인.
- 공개용 키가 아닌 가짜 Secret Key를 넣었을 때 빌드가 중단되는 것을 확인.
- 로컬 서버 없이 임시 Chrome 프로필과 모의 Supabase 응답으로 검증: 미설정 상태, 탭 전환, 비밀번호 불일치, 이메일 확인 대기, 로그인 실패·성공, 기존 화면 이동, 새로고침 세션 유지, 로그아웃, 만료된 링크 안내, 비밀번호 재설정 요청.
- 비밀번호가 브라우저 localStorage에 자체 저장되지 않음을 확인.
- 기존 퀴즈 20문항 렌더링 확인. 외부 D3 로드는 오프라인 점검에서 제외했으므로 차트·전체 회귀는 클라우드에서 추가 확인 필요.
- 실제 Supabase 가입·메일 발송·SQL/RLS 적용·두 계정의 권한·운영 배포는 아직 검증하지 않음.

다음 사용자 단계: Supabase 무료 계정 생성 후 Dashboard 접속 확인. 프로젝트 생성과 SQL 적용은 그다음 한 단계씩 진행.

### Supabase 연결 진행 상태

- 사용자가 Free 프로젝트 생성, SQL 실행 성공, 이메일 가입·Confirm email 활성화와 URL 설정을 확인함.
- 운영 Site URL: `https://moonble.com`, Redirect URL: `https://moonble.com/login.html`.
- 제공받은 Project URL과 Publishable Key를 Git 제외된 `.env`에 저장하고 실제 설정으로 `dist/` 재빌드 완료. 키 자체는 문서에 기록하지 않음.
- 공개 API 읽기 전용 확인: 인증 설정 HTTP 200, 이메일 인증 활성화, 신규 가입 허용, 이메일 자동 확인 비활성화.
- 비로그인 profiles 조회는 HTTP 401 / PostgreSQL `42501`로 거부됨.
- 다음 단계는 Cloudflare Pages 프리뷰 배포와 해당 프리뷰 Redirect URL 추가. 실제 가입, 이메일 발송, 두 계정의 RLS, 비밀번호 복구와 전체 회귀 검증은 남아 있음.

### Cloudflare 브랜치 설정 복구 (2026-10-13)

- develop이 Production branch로 지정되어 `79acba6`이 Production으로 배포된 것을 확인함.
- 사용자가 Production branch를 main, Preview Include를 develop으로 수정·저장함.
- 기존 main `03a9d3c` 배포 `4615487e`로 Rollback 성공을 확인함. GitHub main 코드는 변경하지 않음.
- 이전 develop 배포의 Production 표시는 과거 배포 기록임. 새 develop 배포가 Preview로 분류되는지 별도로 확인해야 함.

미로그인 홈 진입 → 로그인 이동, 로그인 후 기존 20문항 표시, 새로고침 세션 유지, 로그아웃 후 홈 재접속 차단을 모의 인증 API 브라우저 테스트로 확인함. 실제 이메일 인증은 별도 클라우드 검증 대상.

로그인·회원가입 별도 페이지, 첫 로그인 이름·회사 입력, PRD 기본 랜딩과 기존 PRD 작성 화면, 내 정보 수정, 문제지 카드에서 풀이 진입, 로그아웃 복귀를 모의 Supabase 브라우저 테스트로 확인함.
