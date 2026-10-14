# Moonble 초기 인증·배포 설정 작업 기록

- 작업일: 2026-10-13 (KST)
- 저장소: `AlexJJNam/moonble`
- 목적: 기존 Moonble 기능과 디자인을 유지하면서 회원가입·로그인 기반을 추가하고, 개발과 운영 배포 경로를 분리한다.
- 기록 원칙: API 키 값, DB 비밀번호, `.env` 내용과 인증 토큰은 이 문서에 남기지 않는다.

## 1. 작업 전 상태

- 기존 Moonble은 정적 HTML 중심으로 구성되어 있었다.
- GitHub 저장소와 Cloudflare Pages의 운영·개발 브랜치 역할이 정리되어 있지 않았다.
- 회원가입, 로그인 세션, 프로필 DB, 로그인 후 사용자 화면이 없었다.
- 기존 문제풀이 기능과 디자인은 그대로 유지하기로 했다.

## 2. GitHub 연결과 브랜치 정책

GitHub CLI를 설치하고 GitHub Device Login 방식으로 계정 연결을 완료했다. 인증 코드는 이메일로 받는 방식이 아니라 브라우저에 표시된 GitHub Device Code를 입력하는 방식으로 진행했다.

원격 저장소를 다음 주소로 연결했다.

```text
https://github.com/AlexJJNam/moonble.git
```

브랜치 역할은 다음과 같이 결정했다.

| 브랜치 | 용도 | 배포 환경 |
| --- | --- | --- |
| `develop` | 개발 및 Codex 작업 | Cloudflare Preview |
| `main` | 검증된 운영 버전 | Production, `moonble.com` |

`main`에는 사용자 승인 없이 직접 Push하지 않고, 기능 구현과 검증은 먼저 `develop`에서 수행하는 정책을 세웠다.

## 3. Supabase 프로젝트 설정

Supabase Free 프로젝트 `moonble`을 생성하고 서울 리전의 프로젝트를 사용했다.

프런트엔드에서 사용하는 환경변수 이름은 다음 두 개로 정했다.

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

- 브라우저에는 Supabase Publishable Key만 사용한다.
- Service Role Key, API Secret Key, DB 비밀번호는 프런트엔드와 Git 저장소에 넣지 않는다.
- 실제 값은 로컬 `.env`와 배포 서비스의 환경변수에만 저장한다.
- `.gitignore`에서 `.env`, `.env.*`를 제외하고 `.env.example`만 추적하도록 했다.

### Authentication 설정

Supabase Dashboard에서 다음 항목을 확인하거나 설정했다.

- Email Provider: 활성화
- 신규 사용자 가입: 허용
- 이메일 확인: 활성화
- 이메일 변경 보안 확인: 활성화
- 익명 로그인: 비활성화
- Site URL: `https://moonble.com`
- Redirect URL: `https://moonble.com/login.html`

개발 Preview에서 실제 이메일 인증을 시험할 때는 해당 Cloudflare Preview의 `login.html` 주소도 Redirect URL 허용 목록에 추가해야 한다.

### 프로필 테이블과 RLS

Supabase SQL Editor에서 `database/001_profiles.sql`을 실행했다. 이 SQL은 다음을 구성한다.

- `public.profiles` 테이블 생성
- `auth.users.id`와 연결되는 사용자별 프로필 행
- Row Level Security 활성화
- 로그인 사용자가 자신의 프로필만 조회·생성할 수 있는 정책
- 신규 Auth 사용자 생성 시 프로필을 자동 생성하는 Trigger
- 기존 Auth 사용자에 대한 프로필 Backfill
- `anon`의 프로필 접근 차단

이 단계에서 SQL 실행 결과 `Success. No rows returned`를 확인했다. 이는 DDL과 설정 SQL이 정상 실행됐다는 뜻이다.

## 4. React 인증 기능 구성

기존 정적 페이지를 유지하면서 Vite와 React를 추가했다.

주요 구성은 다음과 같다.

| 파일 또는 영역 | 역할 |
| --- | --- |
| `login.html`, `signup.html` | 로그인과 회원가입을 분리한 진입 페이지 |
| `src/login.jsx` | Supabase 이메일 회원가입·로그인·비밀번호 복구 UI |
| `src/supabase.js` | Supabase 클라이언트와 설정 검증 |
| `src/account.jsx` | 세션 확인, 미로그인 이동, 로그아웃 |
| `src/profile.js` | 이름·회사 프로필 메타데이터 처리 |
| `prd.html`, `src/prd/` | 로그인 후 PRD 작업 공간과 내 정보 수정 |
| `quiz.html`, `src/quiz-library.jsx` | 문제지 카드 목록과 기존 문제풀이 진입 |
| `database/001_profiles.sql` | 사용자 프로필 테이블, RLS, 가입 Trigger |

첫 로그인 시 이름과 회사명을 입력하도록 했고, 이후 내 정보 화면에서 수정할 수 있도록 구성했다. 로그아웃하면 로그인 페이지로 복귀하도록 했다.

인증 상태를 확인하는 동안 기존 화면이 먼저 노출되지 않게 세션 확인 가드를 추가했다. 비동기 처리 문구는 이후 스피너 UI로 교체했다.

## 5. Cloudflare Pages 연결

Cloudflare Pages에서 GitHub 계정 `AlexJJNam`과 저장소 `moonble`을 연결했다.

빌드 설정은 다음과 같다.

| 항목 | 값 |
| --- | --- |
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | 비움, 저장소 루트 사용 |
| Build system version | Version 3 |
| Build comments | Enabled |

Cloudflare의 Variables and secrets에는 다음 공개용 빌드 변수를 등록했다.

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

환경변수 값은 이 문서와 Git 저장소에 기록하지 않았다.

### Branch control 설정과 복구 기록

초기 설정 중 `develop`이 Production branch로 지정되어 개발 커밋 `79acba6`이 Production 배포로 분류되는 문제가 발생했다.

다음 순서로 복구했다.

1. Production branch를 `main`으로 변경했다.
2. Preview branch를 `Custom branches`로 선택했다.
3. Include Preview branches에는 `develop`만 등록했다.
4. Exclude Preview branches는 비워 두었다.
5. 기존 `main` 커밋 `03a9d3c`의 배포 `4615487e`로 Production을 Rollback했다.
6. `develop`에 후속 커밋 `0e673a1`을 Push해 Preview 환경으로 분류되는 것을 확인했다.

최종 브랜치 배포 정책은 다음과 같다.

```text
Production branch: main
Preview branches: develop만 자동 배포
```

과거 배포 목록에 `develop`이 Production으로 표시되는 항목은 설정 오류 당시의 이력이며, 현재 정책을 뜻하지 않는다.

## 6. 보안 점검

다음 항목을 확인했다.

- `.env`가 Git 추적 대상에 포함되지 않음
- API Secret Key, Service Role Key, DB 비밀번호가 저장소에 없음
- 프런트엔드에는 Publishable Key만 사용
- 비밀번호를 애플리케이션의 localStorage에 직접 저장하지 않음
- 비로그인 사용자의 `profiles` 조회가 HTTP 401 / PostgreSQL `42501`로 차단됨
- Secret Key 형태의 값을 프런트엔드 환경변수에 넣으면 빌드가 중단되도록 검증

Publishable Key는 브라우저에서 사용하는 공개용 키지만, 값 자체는 운영 기록 문서에 복사하지 않는 방식을 유지한다.

## 7. 빌드와 동작 검증

로컬에서 다음 빌드가 성공했다.

```bash
npm ci
npm run build
```

빌드 결과물은 `dist/`에 생성했다. 기존 정적 페이지와 자산도 결과물에 복사해 기존 경로를 유지했다.

임시 Chrome 프로필과 모의 Supabase 응답으로 다음 흐름을 점검했다.

- 미로그인 사용자의 로그인 페이지 이동
- 로그인과 회원가입 페이지 분리
- 비밀번호 불일치와 로그인 실패 처리
- 이메일 확인 대기 상태
- 로그인 성공 후 세션 유지
- 새로고침과 다른 탭의 세션 반영
- 첫 로그인 이름·회사 입력
- 내 정보 수정
- PRD 작업 공간 진입
- 문제지 목록에서 기존 문제풀이 화면 진입
- 로그아웃 후 로그인 화면 복귀
- 비밀번호 재설정 요청과 만료 링크 안내
- 기존 20문항 문제 렌더링

실제 메일 발송, 복구 메일, 두 계정 간 RLS 검증은 별도의 운영 환경 검증 항목으로 남겼다.

## 8. 작업 중 생성된 주요 커밋

| Commit | 내용 |
| --- | --- |
| `b00ac91` | React 회원가입·로그인과 Supabase 인증 추가 |
| `79acba6` | Cloudflare Production/Preview 설정 문서화 |
| `0e673a1` | Production Rollback과 Preview 브랜치 설정 복구 기록 |
| `8b09057` | 미로그인 상태에서 Moonble 홈 노출 차단 |
| `b851b50` | 기존 Moonble 로고 적용과 불필요한 홈 링크 제거 |
| `d7d44a6` | PRD 작업 공간, 첫 프로필 입력, 문제지 목록 추가 |
| `80c5375` | 계정 비동기 처리 상태에 스피너 적용 |

## 9. 2026-10-13 종료 시점의 상태

- GitHub 저장소 연결과 CLI 인증 완료
- `develop`과 `main` 브랜치 역할 분리 완료
- Cloudflare Pages Git 연동과 자동 빌드 설정 완료
- 잘못 배포된 `develop` Production을 기존 `main` 배포로 Rollback 완료
- Supabase 이메일 인증과 URL 설정 완료
- 프로필 테이블, RLS, 신규 사용자 Trigger 적용 완료
- React 로그인·회원가입·프로필·PRD·문제지 목록 구현 완료
- 환경변수와 민감정보의 Git 제외 확인

## 10. 후속 작업 시 주의사항

- 운영 반영은 `develop` Preview에서 검증한 뒤 `main`에 반영한다.
- Supabase URL이나 Publishable Key를 바꾸면 Cloudflare 환경변수와 로컬 `.env`를 각각 갱신하고 다시 빌드한다.
- 새로운 운영 도메인이나 Preview URL에서 인증할 때는 Supabase Redirect URL 허용 목록을 함께 갱신한다.
- Supabase 기본 SMTP는 발송 대상과 발송량에 제한이 있으므로 공개 운영 전 별도 SMTP 필요 여부를 확인한다.
- PRD와 일부 문제풀이 데이터는 브라우저 localStorage에 저장되므로 다른 기기와 자동 동기화되지 않는다.
- 과거 Cloudflare 배포의 Environment 표시는 당시 설정을 보존한 이력이다. 현재 Branch control 설정을 기준으로 판단한다.
