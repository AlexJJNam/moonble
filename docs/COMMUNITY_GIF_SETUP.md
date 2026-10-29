# 커뮤니티 GIF(KLIPY)와 프로필 사진 설정

커뮤니티 글·댓글에 GIF를 검색해 붙이는 기능은 [gif-picker-react](https://github.com/MrBartusek/gif-picker-react)(MIT)와 KLIPY API를 사용한다. 키가 없으면 GIF 버튼만 숨겨지고 나머지 커뮤니티 기능은 그대로 동작한다.

## 1. DB 마이그레이션

Supabase SQL Editor에서 `database/013_community_gif_avatars.sql`을 한 번 실행한다(012 이후).

- `community_posts`, `community_post_comments`에 `gif` 열을 추가한다. 기존 글·댓글은 바꾸지 않는다.
- 본문 없이 GIF만 있는 글·댓글을 허용한다.
- 글쓰기·댓글 RPC에 `p_gif`(기본값 null)를 추가한다. GIF 없이 호출하는 기존 클라이언트도 그대로 동작한다.
- 서버에서 GIF를 다시 검증한다: 제공업체 `klipy`, 미디어 URL은 `https://static.klipy.com`·`static1`·`static2` 도메인만, 따옴표·꺾쇠·공백 금지, 크기 1~4096.
- 저장소 정책 `profile_avatars_select_community`: 커뮤니티에 글이나 댓글이 남아 있는 사용자의 **현재** 프로필 사진만 다른 사람이 읽을 수 있다. 이전 사진 파일과 활동이 없는 사용자의 사진은 계속 본인만 볼 수 있다.

## 2. KLIPY 앱 키

1. [KLIPY Partner Panel](https://partner.klipy.com)에 가입하고 API Keys에서 웹 플랫폼을 추가해 앱 키를 발급한다.
2. 파트너 패널에서 해당 앱 키의 **광고를 끈다**. 라이브러리는 광고 항목을 표시하지 않는데, KLIPY는 결과를 임의로 빼는 것을 금지하므로 광고가 켜져 있으면 안 된다.
3. 파트너 패널의 콘텐츠 필터(검색어·키워드 차단)를 필요에 맞게 설정한다. 앱은 요청마다 `content_filter=high`를 보낸다.
4. 테스트가 끝나면 파트너 패널에서 프로덕션 접근을 신청한다.

KLIPY 앱 키는 공식 방식대로 브라우저에서 사용하는 공개 키다(KLIPY는 서버 경유 요청을 사전 승인 없이 허용하지 않는다). Supabase Secret/Service Role Key 같은 서버 자격 증명과 다르며, 그런 값은 프런트엔드에 넣지 않는다.

키를 넣는 곳:

| 환경 | 위치 |
| --- | --- |
| 로컬 | `.env`의 `VITE_KLIPY_APP_KEY` |
| 운영(GitHub Pages) | GitHub 저장소 Settings → Secrets and variables → Actions → **Variables**의 `VITE_KLIPY_APP_KEY` (`pages.yml`이 빌드에 전달) |
| develop 미리보기(Cloudflare Pages) | Cloudflare Pages 프로젝트 설정 → 환경 변수(Preview)의 `VITE_KLIPY_APP_KEY` |

## 3. KLIPY 이용 조건 반영

- 검색창 기본 문구 "Search KLIPY"(필수): 라이브러리가 자동으로 표시한다. 선택기 하단에 "Powered by KLIPY"(선택)도 표시한다.
- 미디어는 API가 준 URL을 그대로 사용자 브라우저에서 불러온다. GIF 파일을 다운로드하거나 Supabase Storage에 올리지 않고 URL·ID·크기만 저장한다.
- 검색·인기 결과의 순서와 구성을 바꾸지 않는다. 선택 시 KLIPY share 이벤트를 보낸다(라이브러리 기본 동작). 사용자 식별자(`customer_id`)는 보내지 않는다.
- 참고: https://docs.klipy.com/integration-requirements , https://docs.klipy.com/attribution , https://docs.klipy.com/network-requirements
