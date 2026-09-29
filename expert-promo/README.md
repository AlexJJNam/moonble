# Expert 프로모션 · 개발팀 전달본

4배율 디자인 이미지 `expertpromo.jpg`와 확보한 Figma 레이어 규격을 기준으로 구현한 정적 HTML/CSS/JS 페이지입니다.

## 실행 및 전달

`index.html`을 브라우저에서 열거나, 이 폴더 전체를 웹서버의 원하는 하위 경로에 배치하세요. 별도 빌드나 패키지 설치가 필요하지 않습니다.

- 이미지, SVG, CSS, JS는 상대경로로 연결했습니다. 폰트는 외부 CDN을 참조합니다.
- 이미지와 SVG는 Figma에서 확보한 원본 파일이며, 임시 Figma 주소를 사용하지 않습니다.
- Pretendard와 Paperlogy는 jsDelivr CDN의 WOFF2를 `@font-face`로 로딩합니다. 400/500/600/700 굵기와 `font-display:swap`을 적용했습니다. 기존 assets/fonts 파일은 보관용이며 현재 페이지에서 참조하지 않습니다.
- 페이지 최대 너비는 480px, 기준 시안은 375px입니다.
- 문구와 버튼은 HTML, 배치와 장식은 CSS로 구성했습니다. 전체 시안 이미지를 페이지에 붙이지 않았습니다.

## 타이머 및 버튼 효과

- 마감: **2026-10-02 23:59:59 한국시간(+09:00)**. `js/config.js`의 `deadline`에서 변경합니다.
- 하단 고정 타이머는 매초 갱신하며 마감 이후 ‘종료됨’을 표시합니다. 바 높이와 안전 영역에 필요한 여백은 푸터 내부에 확보하며 푸터 아래 별도 여백은 없습니다.
- 네 버튼 문구는 ‘평생반값 혜택받기’입니다. 첨부 HTML과 같은 민트색 2.6초 샤인 효과를 적용했습니다.
- 모션 감소 설정에서는 이동 효과를 끕니다.
- `docs/preview-countdown.png`: 실제 화면의 고정 타이머·버튼 미리보기. 전체 길이 미리보기는 본문 영역을 표시합니다.

## 결제 연결 — 개발팀 필수 설정

각 버튼은 `join(expertId, productId, discountPct, discountAmt)`를 통해 아래 앱 핸들러를 호출합니다.

```js
window.flutter_inappwebview.callHandler(
  'thinkpool_webview_handler',
  'webToApp_goLandingPageExp',
  { landingPage: 'LPTP', expertId, productId, discountPct, discountAmt }
);
```

`js/config.js`의 `products`에 사용자가 전달한 전문가별 값을 반영했습니다. 공통값은 `discountPct: '55'`, `discountAmt: '220000'`입니다. 사용자 정정에 따라 기존 금액을 유지합니다.

| 설정 키 | 전문가 | expertId | productId |
|---|---|---|---|
| `surge-hunter` | 서지헌터 | `ebirang22` | `rc_e15.am1d5` |
| `trader-shin` | 트레이더신 | `kkmad111` | `rc_e14.am1d5` |
| `absolute-wealth` | 절대부유 | `ixtous` | `rc_e11.am1d5` |
| `gold-spoon` | 금수저 | `acafera` | `rc_e13.am1d5` |

상품코드는 `rc_e번호.am1d5` 형식입니다. 절대부유는 기존 `_11`을 다른 전문가와 같은 형식인 `rc_e11.am1d5`로 맞췄습니다.

버튼 클릭 시 원본 코드처럼 앱 핸들러를 즉시 호출합니다. 응답 대기나 시간제한을 적용하지 않습니다. 앱 브리지 없음 또는 핸들러 오류는 토스트로 표시합니다. 일반 브라우저에서는 Flutter 결제화면을 열 수 없습니다.

버튼은 `join()`을 직접 호출하며 기존 중간 취소 이벤트는 사용하지 않습니다.

서비스 소개의 선택 안내는 전문가 섹션으로 스크롤하고, 고객센터 전화번호는 `tel:` 링크입니다. 카카오톡 채널 URL은 제공되지 않아 원본처럼 텍스트 안내로 유지했습니다.

## 구성

- `index.html`: 8개 섹션 전체 마크업.
- `styles/fonts.css`: 웹폰트 선언.
- `styles/event.css`: 섹션별 스타일과 반응형 보정.
- `js/config.js`: 전문가별 Flutter 결제 파라미터 설정.
- `js/countdown.js`: 마감 시각 계산 및 고정바 여백 처리.
- `js/price-counter.js`: 첫 가격 카드 노출 시 할인율 숫자 카운트업. 혜택가는 99,000원 고정.
- `js/event.js`: 버튼, 사용자 안내, 호스트 연동 이벤트.
- `assets/images`, `assets/icons`, `assets/fonts`: 상대경로 원본 파일.
- `assets/asset-manifest.json`: 원본 파일 식별자, 치수, 해시, 전문가 매핑.
- `docs/preview-*.png`: 브라우저 미리보기.
- `docs/reference/expertpromo-4x.jpg`: 제공받은 4배율 디자인, 문서용 참조.
- `docs/verification.json`: 7개 화면 폭의 실제 브라우저 치수·이미지 로딩 검사.
- `docs/interaction-verification.json`: 버튼 이벤트, 키보드, 앵커 이동 검수.
- `scripts/check-assets.py`: 상대경로와 원본 파일 무결성 검사.

```sh
python3 scripts/check-assets.py
```

## 디자인 기준

Figma: https://www.figma.com/design/wPG5UayhakJg6zMyEvbPFN/?node-id=1290-1189

375px 기준 전체 높이는 약 5435.36px입니다. 좁은 화면에서는 긴 문구를 줄바꿈하고 필요한 높이를 확보합니다. 전문가 인물의 개별 크롭과 배경 효과는 제공된 JPG와 대조했습니다. 상세 Figma 재조회는 플랜 제한으로 이용할 수 없었습니다.

원본의 가격 99,000원, 정가 220,000원, -55%, ‘평생 반값’, 기간 표기는 그대로 유지했습니다.

## 폰트 출처

- Pretendard: https://github.com/orioncactus/pretendard (`assets/fonts/Pretendard-LICENSE.txt` 포함)
- Paperlogy 웹폰트: https://github.com/fonts-archive/Paperlogy
- Paperlogy 배포처: https://freesentation.blog/paperlogyfont

ZIP에는 macOS `._` 메타데이터 파일을 제외했습니다.

## 히어로 팝아웃 수정 (2026-09-29)

- 두 개의 인물 이미지 레이어를 한 장으로 통합하여 목·몸통의 잘린 경계를 제거했습니다.
- 프레임은 인물 뒤에, 하단 테두리는 앞에 배치했습니다. 하단 모서리만 둥글게 잘라 머리가 프레임 위로 나오도록 했습니다.
- `assets/icons/hero-sketch-frame.svg`는 사용자가 추가로 제공한 스크린샷의 손그림 민트 테두리를 참고해 제작한 벡터입니다. Figma에서 내려받은 원본 애셋과 구분하여 manifest에 기록했습니다.
- 320/360/375/390/430/480/1280px에서 이미지 로딩 정상, 가로 넘침 없음. 375px 기준 전체 높이 5435.36px 유지.
- 수정 결과: `docs/preview-hero-popout.png` 및 전체 너비별 미리보기.

## 앱 헤더가 있는 WebView의 상단 여백

- 제공된 실제 앱 화면에 맞춰 스티키의 상단 추가 inset 기본값을 0으로 변경했습니다. `--sticky-safe-top:0px`로 높이 42px, 문구 수직 중앙, 닫기 버튼 top 0을 유지합니다.
- 앱이 상단 안전 영역을 처리하지 않는 전체화면 WebView에 재사용할 때만 `:root{--sticky-safe-top:env(safe-area-inset-top,0px)}`로 설정하세요. 하단 안전 여백은 그대로 유지합니다.
- 모의 기기 상단 inset 47px에서도 띠 높이 42px, 텍스트 중앙 21px 확인: sticky-inset-verification.json.
- 화면 상단의 흰색 네이티브 닫기 헤더는 HTML 바깥이므로 이 CSS 수정 대상이 아닙니다.
