# 공유 링크 미리보기 Worker 배포

`share.moonble.com/{token}`은 사람 방문자를 Moonble 문제풀이 화면으로 보내고, 카카오톡·Slack 등 링크 미리보기 봇에는 DB에 저장된 문제지 제목과 설명, Moonble OG 이미지를 제공합니다.

## GitHub Actions 설정

`AlexJJNam/moonble` 저장소의 **Settings → Secrets and variables → Actions**에서 다음 값을 설정합니다.

- Repository secret `CLOUDFLARE_API_TOKEN`: Cloudflare에서 만든 Workers 배포용 API 토큰
- Repository secret `CLOUDFLARE_ACCOUNT_ID`: Cloudflare 계정 Overview에 표시된 Account ID
- Repository variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`: Pages 배포에 이미 사용 중인 공개 Supabase 설정값

Cloudflare API 토큰은 Workers 스크립트 편집 권한과 `moonble.com` Zone의 Workers Routes 쓰기 권한이 필요합니다. 계정·Zone 범위는 Moonble이 속한 계정과 `moonble.com`으로 제한합니다. 계정 전역 API 키는 사용하지 않습니다.

필요한 값이 준비되면 `main`에 Worker 파일이 반영될 때 GitHub Actions가 자동으로 `moonble-quiz-share-preview`를 배포하고 `share.moonble.com` 커스텀 도메인을 연결합니다. Cloudflare Custom Domain이 DNS와 인증서를 관리합니다.

## DB 설정

문제지 공유 링크 조회는 `database/003_quiz_banks_and_shares.sql`의 `moonble_get_quiz_share` RPC를 사용합니다. 비로그인 제출 알림도 사용하려면 `database/005_quiz_share_submissions_notifications.sql`을 Supabase SQL Editor에서 한 번 실행해야 합니다.

## 확인

- 브라우저로 `https://share.moonble.com/{활성-공유토큰}`을 열면 `moonble.com/solve.html#share=...`로 이동합니다.
- KakaoTalk 또는 Facebook 크롤러 요청에는 해당 문제지 제목·설명과 `/assets/moonble-open-graph.png`가 들어간 HTML 메타데이터가 반환됩니다.
- 잘못됐거나 중지된 토큰은 404를 반환합니다.
