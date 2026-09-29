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

## 앱 헤더가 있는 WebView의 상단 여백

- 제공된 실제 앱 화면에 맞춰 스티키의 상단 추가 inset 기본값을 0으로 변경했습니다. `--sticky-safe-top:0px`로 높이 42px, 문구 수직 중앙, 닫기 버튼 top 0을 유지합니다.
- 앱이 상단 안전 영역을 처리하지 않는 전체화면 WebView에 재사용할 때만 `:root{--sticky-safe-top:env(safe-area-inset-top,0px)}`로 설정하세요. 하단 안전 여백은 그대로 유지합니다.
- 모의 기기 상단 inset 47px에서도 띠 높이 42px, 텍스트 중앙 21px 확인: sticky-inset-verification.json.
- 화면 상단의 흰색 네이티브 닫기 헤더는 HTML 바깥이므로 이 CSS 수정 대상이 아닙니다.

## 원본 결제 코드 임시 적용

- 사용자 요청으로 네 버튼 모두 dsuk10 / rc_st.am1d5_e2 / 55 / 220000을 임시 사용합니다. 전문가별 구분된 실제 설정은 추후 교체가 필요합니다.
- join()에서 원본과 동일하게 thinkpool_webview_handler, webToApp_goLandingPageExp, landingPage:LPTP 및 네 인자를 즉시 전달합니다. 중간 취소 이벤트, 브리지 대기 및 응답 시간제한은 제거했습니다. 오류 토스트는 유지합니다.
- 모의 브리지로 네 버튼의 즉시 호출과 정확한 값 전달 확인: original-bridge-verification.json. 실제 앱 이동은 앱에서 확인해야 합니다. 이전 빈 설정·응답 대기 검수는 변경 전 이력입니다.

## 전문가별 결제값 반영

- 서지헌터 ebirang22 / rc_st.am1d5_e15, 트레이더신 kkmad111 / rc_st.am1d5_e14, 절대부유 ixtous / rc_st.am1d5_11, 금수저 acafera / rc_st.am1d5_e13.
- 공통 discountPct='55', discountAmt='22000': 이번 사용자 입력을 그대로 반영했으며 이전 예시 220000과 구분합니다.
- 네 버튼별 실제 전달 인자를 모의 브리지에서 검증했습니다. expert-mapping-verification.json 참고. 실제 앱 결제화면 이동은 앱에서 확인해야 합니다. 이전 임시 공통 상품 매핑 기록을 대체합니다.

## 공통 금액 오타 정정

사용자 정정에 따라 네 전문가 모두 discountAmt='220000'으로 수정했습니다. 할인율 55와 전문가별 ID/상품코드는 유지하며 모의 브리지 전달값 재검증을 통과했습니다. 앞선 22000 기록은 오타 정정 전 이력입니다.
