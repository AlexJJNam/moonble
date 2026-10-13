# 회원가입 동의와 운영 배포

변경일: 2026-10-14

## 로그인 대기 화면 원인과 배포

moonble.com은 GitHub Pages의 main 루트 소스 배포(legacy)에 연결되어 있었다. React JSX가 브라우저에 직접 전달되어 계정 확인 모듈이 실행되지 않고 인증 대기 화면만 남았다.

`.github/workflows/pages.yml`은 main Push 시 npm ci → npm run build → dist 업로드 → GitHub Pages 배포를 수행한다. develop은 Cloudflare 미리보기로 유지한다. GitHub Pages의 source는 GitHub Actions(workflow)로 설정한다. Cloudflare Pages도 기존 npm run build / dist 설정을 유지한다. 도메인 DNS는 변경하지 않는다.

GitHub 저장소 Actions variables에 VITE_SUPABASE_URL과 VITE_SUPABASE_PUBLISHABLE_KEY를 등록한다. 공개용 Publishable Key만 사용한다. Secret/Service Role Key와 DB 비밀번호는 저장소·빌드·브라우저에 넣지 않는다. 두 변수가 없으면 GitHub 운영 빌드는 실패하도록 한다.

## 동의 동작

- 회원가입 페이지에만 필수 이용약관, 개인정보 수집·이용 체크박스를 제공한다. 처음에는 모두 미선택이다.
- HTML required와 submit 검증을 함께 적용한다. 한 항목이라도 미동의하면 프런트엔드에서 가입 요청을 보내지 않는다.
- 각 내용 보기 링크는 새 창으로 열어 입력 중인 가입 정보를 유지한다.
- 가입 시 Supabase auth user_metadata.signup_consents에 동의 여부·버전·클라이언트 시각을 보낸다. 기존 회원의 동의를 소급해서 생성하지 않는다.
- 이 기록은 사용자가 수정 가능한 메타데이터다. 서버에서 강제하는 동의 검증이나 변경 불가능한 법적 감사 기록은 아니다. 그런 보장이 필요하면 Auth hook과 별도 서버 기록을 추가해야 한다.
- 마케팅·광고 수신 동의는 실제 기능이 없으므로 추가하지 않았다.

## 개인 운영 서비스 안내

참고 사이트의 사업자명·전화번호·주소를 복제하지 않는다. Moonble에 확인되지 않은 사업자 정보를 만들지 않는다. 문의 이메일은 푸터에 표시하지 않는다. GitHub와 Cloudflare 두 실제 배포 환경을 호스팅 항목에 표시한다.

개인정보 처리방침과 이용 안내는 현재 구현을 기준으로 작성했다. 유료 사업 전환, 외부 처리업체·처리 리전·분석 설정 변경 시 운영자가 실제 상황에 맞게 수정해야 한다. 이 문서나 체크박스 구현만으로 법률상 모든 의무가 검증됐음을 뜻하지 않는다.

## 개인정보 요청 운영

내 정보 화면에서 열람·정정 상담·처리정지·삭제 요청을 받을 수 있다. 요청은 인증된 본인의 user_metadata.privacy_request(kind/requested_at/status)에 접수한다. 즉시 계정 삭제나 외부 메시지 전송은 수행하지 않는다. 같은 계정의 새 요청은 이전 요청을 대체한다.

운영자는 Supabase Authentication → Users에서 요청을 정기적으로 확인해야 한다. 이메일 등 본인 확인된 계정 정보로 필요한 후속 내용을 확인하고, 요청 종류에 따라 직접 처리한다. 삭제 요청은 Supabase 관리 화면에서 해당 계정과 연결 데이터를 삭제해야 완료된다. 다른 기기의 localStorage에 남은 PRD·문제 기록은 서버에서 지울 수 없으며 이용자에게 사이트 데이터 삭제를 안내한다. 자동 알림·자동 삭제 기능은 없다.

## 참고한 공식 문서

- [개인정보 포털 — 개인정보 수집·이용 고지 사항](https://www.privacy.go.kr/front/contents/cntntsView.do?contsNo=36)
- [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Supabase signUp](https://supabase.com/docs/reference/javascript/auth-signup)
