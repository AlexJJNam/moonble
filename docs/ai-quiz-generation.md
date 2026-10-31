# 문블 AI 문제지 생성 운영 안내

- 로그인된 회원의 요청을 Edge Function에서 Supabase Auth `getUser`로 확인한 뒤 Gemini `gemini-3.5-flash-lite`를 호출한다. 키와 서비스 역할 키는 서버에서만 사용한다. 게이트웨이의 구형 JWT 검증을 사용하지 않는 대신 모든 POST 요청을 함수에서 직접 검증한다.
- 구조화된 JSON 20문항을 검증하고 사용자에게 임시 편집 화면을 보여준다. 문제지는 사용자가 저장을 누른 뒤 기존 문제지 저장 및 동기화 로직을 거쳐 저장한다. 프롬프트와 생성 문제지는 사용량 테이블에 저장하지 않는다.
- 회원별 성공 횟수는 한국시간 자정 기준 하루 5회다. DB 잠금으로 실행 중인 예약도 한도에 포함하고, 오류·타임아웃은 실패로 해제한다. 자정을 넘기는 예약은 완료되는 한국시간 날짜의 한도에 확정한다. 중복 요청 ID는 재호출하지 않는다.
- 서버에 `GEMINI_FREE_TIER_CONFIRMED=true`가 없으면 Gemini를 호출하지 않고 기존 외부 AI 흐름으로 넘긴다. 이 값은 Google 프로젝트의 요금제를 확인했다는 운영자 확인값이며 Google의 실제 요금제를 자동으로 검증하지는 않는다. 요금제가 변경되면 이 값을 제거해야 한다.
- 선택적인 `GEMINI_GLOBAL_DAILY_LIMIT`은 한국시간 하루 동안의 서비스 전체 생성 상한이다. 비워두면 별도 서비스 상한을 두지 않는다. Google의 프로젝트 일일 사용량 초기화 시각과 다를 수 있다. Gemini 429의 분당·일일 제한은 응답에 명시된 경우만 기록하며, 알 수 없는 경우에는 단정하지 않는다. 자동 재시도 없이 외부 AI로 전환한다.
- 운영 로그에는 결과 상태, HTTP 상태 및 토큰 수만 기록한다. 사용자 입력, 생성 내용, 키는 기록하지 않는다.

## 운영 적용

1. [035_ai_quiz_generation.sql](../database/035_ai_quiz_generation.sql)을 Supabase SQL Editor에서 실행한다. 기존 데이터와 문제지를 삭제하지 않는다.
2. Google AI Studio에서 해당 Gemini 프로젝트가 무료 요금제인지 확인한다. 확인한 경우 Supabase → Edge Functions → Secrets에 `GEMINI_FREE_TIER_CONFIRMED` 값을 `true`로 추가한다. 기존 `GEMINI_API_KEY`는 그대로 사용한다. 전체 제한이 필요할 때만 `GEMINI_GLOBAL_DAILY_LIMIT`을 양의 정수로 추가한다.
3. GitHub Actions의 `Deploy AI quiz generation`을 실행하거나, 프로젝트 연결 및 권한이 있는 환경에서 `supabase functions deploy generate-quiz --project-ref <PROJECT_REF> --no-verify-jwt`를 실행한다. 함수는 별도로 사용자 토큰을 검증한다.
4. 사이트를 배포한 뒤 로그인 회원의 정상 생성, 5회 제한, 새로고침 및 두 기기의 동시 요청, 429·장애 전환, 편집 후 저장을 확인한다. 서버 로그에서 입력과 키가 노출되지 않는지 확인한다.

무료 요금제의 모델별 한도는 고정하지 않는다. Google 프로젝트의 실제 요금제와 제한을 Google AI Studio에서 계속 확인해야 한다. 현재 구조는 Google 청구 설정을 조회할 권한이 없으므로 무료 요금제를 기술적으로 강제할 수 없다.
