import React from 'react';
import { createRoot } from 'react-dom/client';
import { SiteFooter } from './site-footer.jsx';
import { POLICY_VERSION } from './policy.js';
import { BrandLogo } from './brand-logo.jsx';
import './design-system.css';
import './legal.css';

const privacy = /\/privacy(?:\.html)?\/?$/.test(location.pathname);
function Privacy() {
  return <>
    <p>Moonble은 개인이 운영하는 PRD 작성·문제풀이 서비스입니다. 회원정보를 다음과 같이 처리합니다.</p>
    <h2>1. 수집 항목과 이용 목적</h2>
    <ul><li>이메일·비밀번호: 회원가입, 이메일 인증, 로그인 및 계정 복구. 비밀번호 인증은 Supabase Auth에서 처리합니다.</li><li>이름·회사명(소속): 프로필 표시와 문서 작성자 정보. 첫 로그인 후 입력하며 내 정보에서 수정할 수 있습니다.</li><li>프로필 사진(선택): 프로필 표시. 커뮤니티에 글이나 댓글을 남기면 계정 이름과 함께 다른 이용자에게 표시되며, 커뮤니티 글·댓글을 모두 삭제하면 다시 본인만 볼 수 있습니다.</li><li>커뮤니티 글·댓글: 작성한 내용과 첨부한 문제지 공유 링크·풀이 기록·GIF 정보가 계정 이름과 함께 다른 이용자에게 공개됩니다. 회원 탈퇴 시 함께 삭제됩니다.</li><li>동의 여부·동의 문서 버전·동의 시각: 가입 시 동의 내용을 확인하기 위해 계정 메타데이터에 저장합니다.</li><li>접속 과정의 IP 주소·브라우저 정보·요청 기록은 호스팅·인증 제공업체의 서비스 제공 및 보안 운영 과정에서 처리될 수 있습니다.</li></ul>
    <h2>2. 저장 위치와 보유 기간</h2>
    <p>회원정보는 Supabase에 저장하며 계정 이용 기간 동안 보유합니다. 회원 탈퇴를 완료하면 인증 계정, 프로필과 계정에 연결된 동의 정보를 삭제합니다. 법령에 따른 보존 의무가 발생하면 해당 항목과 기간에 한하여 별도로 보관합니다.</p>
    <p>PRD 문서, 문제풀이 기록과 사용자 문제지는 현재 사용 중인 브라우저의 로컬 저장소에 보관됩니다. 브라우저 데이터를 지우면 사라질 수 있으며 기기 간 자동 동기화되지 않습니다. 회원 탈퇴 시 현재 기기의 계정별 로컬 데이터는 함께 삭제하지만 다른 기기의 로컬 저장소는 삭제할 수 없으므로 해당 기기에서 사이트 데이터를 삭제해주세요.</p>
    <h2>3. 외부 서비스와 처리</h2>
    <ul><li>Supabase: 계정 인증과 회원정보 저장. 현재 프로젝트 데이터베이스 리전은 서울입니다. 서비스 운영·지원 과정의 처리 범위는 제공업체 정책에 따릅니다.</li><li>GitHub Pages·Cloudflare Pages: 웹사이트 호스팅과 파일 전송. 접속 기록이 제공업체의 글로벌 인프라에서 처리될 수 있습니다.</li><li>jsDelivr: 웹폰트와 라이브러리 전송. 파일 요청 시 접속 정보가 전송될 수 있습니다.</li><li>KLIPY: 커뮤니티 GIF 검색과 표시. GIF를 검색하거나 볼 때 검색어와 접속 정보(IP 주소·브라우저 정보)가 이용자의 브라우저에서 KLIPY로 직접 전송됩니다. 회원을 식별하는 정보는 보내지 않습니다.</li><li>Google Analytics: 문제풀이 화면의 방문·이용 통계 측정. 쿠키와 브라우저·방문 정보를 이용하며 보유 기간은 해당 서비스의 설정에 따릅니다. 브라우저의 쿠키 차단 및 Google Analytics 차단 도구로 수집을 제한할 수 있습니다.</li></ul>
    <p>연결된 외부 서비스에 적용되는 정책은 <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">Supabase</a>, <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noopener noreferrer">GitHub</a>, <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">Cloudflare</a>, <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google</a>에서 확인할 수 있습니다.</p>
    <h2>4. 동의 거부 및 정보 관리</h2>
    <p>개인정보 수집·이용에 동의하지 않을 수 있습니다. 필수 회원정보 처리에 동의하지 않으면 회원가입과 회원 전용 기능을 이용할 수 없습니다.</p>
    <p><a href="./account.html">내 계정</a>에서 이름·회사명을 확인하고 수정할 수 있습니다. 같은 화면에서 개인정보 열람·삭제·처리정지 요청 상태를 계정에 기록할 수 있습니다. 요청 버튼만으로 계정이 즉시 삭제되지는 않습니다.</p>
    <h2>5. 보호 조치와 변경 안내</h2>
    <p>인증 및 정보 전송에 HTTPS를 사용하고 계정별 접근을 제한합니다. 개인정보는 공개된 의견 게시판에 올리지 마세요. 이 방침이 변경되면 본 페이지의 시행일과 내용을 갱신하며 동의가 필요한 변경은 별도로 안내합니다.</p>
  </>;
}
function Terms() {
  return <>
    <p>Moonble은 개인이 운영하는 PRD 작성과 GA4 학습을 위한 서비스입니다. 아래 내용은 회원가입과 서비스 이용에 적용됩니다.</p>
    <h2>1. 계정과 이용</h2><p>이메일 인증 후 서비스를 이용할 수 있습니다. 본인의 정보를 입력하고 비밀번호를 안전하게 관리해주세요. 타인의 계정 도용, 서비스 장애 유발, 불법 콘텐츠 등록 등 서비스 이용을 방해하는 행위는 금지됩니다.</p>
    <h2>2. 문서와 문제풀이</h2><p>PRD 문서와 학습 기록은 현재 브라우저에 저장됩니다. 중요한 문서는 별도로 보관해주세요. 학습용 문제와 해설은 실제 서비스나 시험의 최신 기준과 다를 수 있으며 결과를 보증하지 않습니다. 외부 AI나 링크로 이동하면 해당 서비스의 이용 조건이 적용됩니다.</p>
    <h2>3. 이용자가 작성한 콘텐츠</h2><p>직접 작성한 문서의 권리는 작성자에게 있습니다. 다른 사람의 권리를 침해하거나 공개 권한이 없는 개인정보·회사 기밀을 입력하지 마세요.</p>
    <h2>4. 서비스 변경과 계정 삭제</h2><p>개인 운영 및 점검 사정으로 기능이 변경되거나 서비스가 일시 중단될 수 있습니다. 중요한 변경은 서비스 내에서 안내합니다. 계정 삭제와 개인정보 관련 요청은 내 정보 수정 화면에서 접수할 수 있습니다. 이 안내는 법령상 이용자의 권리를 제한하지 않습니다.</p>
    <h2>5. 의견과 개인정보 요청</h2><p>기능 제안과 오류 신고는 하단의 의견 보내기로 전달할 수 있습니다. GitHub 계정이 필요할 수 있으며 게시한 내용은 공개됩니다. 비밀번호·이메일 등 개인정보는 게시하지 말고, 개인정보 관련 요청은 로그인 후 내 정보 수정 화면을 이용해주세요.</p>
  </>;
}
function Legal() { return <><header className="legal-header"><a href="./quiz.html" aria-label="Moonble 문제지 홈"><BrandLogo decorative /></a><a href="./login.html">로그인</a></header><main className="legal-main"><h1 className="mb-page-title">{privacy ? '개인정보 처리방침' : '이용 안내'}</h1><p className="legal-date">시행일 · {POLICY_VERSION}</p>{privacy ? <Privacy /> : <Terms />}</main><SiteFooter /></>; }
createRoot(document.getElementById('root')).render(<Legal />);
