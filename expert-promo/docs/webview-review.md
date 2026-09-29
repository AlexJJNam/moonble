# WebView 검토 결과

## 확인한 범위

Chrome 모바일 에뮬레이션 320×568, 360×640, 375×812, 390×844, 430×932, 480×800, 가로 844×390, 데스크톱 1280×800에서 각 5개 스크롤 위치 검사. 실제 iOS/Android 앱 테스트와는 구분합니다.

- 모든 화면에서 scrollX=0, 문서 너비가 뷰포트 너비 이내. 검사한 문구의 가로 넘침 없음.
- 외부 웹폰트 8개 모두 브라우저에서 loaded 상태.
- 상단 safe area 47px 및 하단 34px을 브라우저로 모의 설정하여 스티키 높이 89px, 닫기 버튼 top 47px, 카운터 하단 padding 48px 확인.
- 모의 Flutter 브리지에서 정확한 인자 전달, 지연 준비, 오류 처리, 10초 무응답 후 토스트 및 버튼 복구 검증.

## 반영한 보완

- 가로 overflow 제한과 overflow:clip 미지원 시 hidden 대체값 추가.
- 이미지 크기 계산에서 cqw 및 CSS 길이/길이 나눗셈 의존을 제거하고 실제 컨테이너 크기로 계산. ResizeObserver가 없으면 resize 이벤트로 처리.
- 모바일 자동 텍스트 확대에 따른 레이아웃 변동을 줄이도록 text-size-adjust:100% 적용. 핀치 줌은 차단하지 않음.
- 상단 스티키에 safe-area-inset-top 적용, 닫기 버튼 가로 터치 영역 44px, 토스트 닫기 영역 44×44px.
- 스티키 확장 중 긴 문구가 잘리지 않도록 좌우 여백 보정.
- 브리지가 없으면 준비 이벤트를 최대 1.5초 기다림. 이미 함수가 있으면 즉시 호출. 호출 응답은 10초 제한, 자동 재호출 없음. 시간초과는 이미 전달된 앱 요청 자체를 취소하지 않음.

## 개발팀 확인이 필요한 항목

- 실제 결제 파라미터 4종은 전문가별로 아직 빈 값. 현재 설정으로는 결제화면 이동 대신 오류 토스트가 표시됨.
- 실제 앱에서 thinkpool_webview_handler 등록, WebView 초기화 시점, 결제화면 이동 및 복귀를 확인해야 함. 앱 핸들러는 이동 처리를 시작한 뒤 응답을 반환하는 것이 권장됨.
- 배포 서버/앱 CSP에서 cdn.jsdelivr.net 웹폰트 요청 허용 필요. CDN 차단·오프라인이면 대체 글꼴로 표시되며 동일한 자간/줄바꿈은 보장하지 않음.
- 실제 WKWebView/Android WebView 기기, 네이티브 SafeArea 구성, 성능, OS 글자크기 확대는 미검증. Safari 자동화 연결은 응답하지 않아 검증 완료로 간주하지 않음.
- 최소 OS 버전이 정해지지 않았으므로 모든 구형 WebView의 호환성을 보장하지 않음.

## 근거

- webview-audit-before.json / webview-audit-after.json
- webview-behavior-verification.json
- [Flutter JavaScript 통신 문서](https://inappwebview.dev/docs/webview/javascript/communication/)
- [CSS safe area env()](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/env)
