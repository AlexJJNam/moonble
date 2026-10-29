import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
import { cpSync, existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';

// 기존 저장소의 정적 페이지도 배포 결과에 유지합니다. 회원가입 소스·환경 파일은 복사하지 않습니다.
const legacyPaths = [
  'CNAME', 'assets', 'avh_rassipromo', 'chatgpt-shell.html', 'expert-promo',
  'expert_note', 'expertpromo.html', 'expertpromo.jpg', 'jjn_chatGPT',
  'jjn_chatGPT_1', 'multi_agent_chatgpt', 'pocketfolio', 'rassi_survey.html',
  'rassipromo', 'rassipromo_avh', 'widget-launcher-src',
  'widget-launcher.html', 'widget-launcher.vanilla.backup.html',
  'stylepass-promo.html', 'stylepass-promo',
  'manifest.webmanifest', 'sw.js',
];

function preserveLegacyPages() {
  let config;
  return {
    name: 'preserve-moonble-static-pages',
    configResolved(value) { config = value; },
    closeBundle() {
      for (const name of legacyPaths) {
        const source = resolve(config.root, name);
        if (!existsSync(source)) continue;
        cpSync(source, resolve(config.root, config.build.outDir, name), {
          recursive: true,
          filter: path => !basename(path).startsWith('._') && !['.env', '.git', 'node_modules'].includes(basename(path)) && !basename(path).startsWith('.env.'),
        });
      }
    },
  };
}

const startupPages = new Set(['index.html', 'quiz.html', 'solve.html', 'account.html', 'prd.html', 'login.html', 'signup.html']);
const moonbleHandwritingPath = 'M8 57 C17 55 24 46 29 40 C33 35 36 36 34 43 C31 52 24 62 28 64 C32 66 41 47 47 43 C52 39 53 46 49 55 C46 62 48 65 53 61 C60 55 61 40 70 36 C79 32 87 39 85 49 C83 58 71 63 64 58 C57 53 61 40 71 36 C81 32 91 38 92 48 C93 58 82 63 76 58 C70 53 74 40 85 36 C95 32 103 38 103 48 C103 56 98 62 101 64 C104 65 110 48 117 42 C122 37 125 38 123 47 C121 55 119 63 123 64 C127 65 134 48 142 43 C148 39 151 42 149 50 C147 58 146 64 150 64 C156 64 163 54 166 48 C171 39 171 25 177 17 C181 12 188 12 191 18 C195 26 187 39 181 47 C175 55 170 61 175 64 C181 68 189 60 193 51 C198 41 198 27 204 18 C208 12 215 12 218 18 C222 26 214 39 208 48 C202 56 199 62 204 64 C210 67 218 58 223 49 C228 41 233 39 236 43 C239 47 231 56 228 59 C232 61 237 58 240 55';

function startupSplash() {
  return {
    name: 'moonble-startup-splash',
    transformIndexHtml: {
      order: 'pre',
      handler(html, context) {
        if (!startupPages.has(basename(context.filename || ''))) return html;
        const splash = `<div id="moonble-startup-splash" role="status" aria-label="Moonble 시작 중" aria-busy="true"><svg viewBox="0 0 240 96" fill="none" aria-hidden="true"><defs><mask id="moonbleStartupLogoMask" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0" width="240" height="96"><rect width="240" height="96" fill="#000"/><path class="moonble-startup-logo-reveal" pathLength="1" d="${moonbleHandwritingPath}"/></mask></defs><image class="moonble-startup-logo-image" href="/assets/moonble-wordmark.png" x="0" y="8" width="240" height="80" preserveAspectRatio="none" mask="url(#moonbleStartupLogoMask)"/></svg></div><script>(function(){var splash=document.getElementById('moonble-startup-splash');if(!splash)return;var nav=performance.getEntriesByType('navigation')[0];var sameOriginReferrer=false;try{sameOriginReferrer=!!document.referrer&&new URL(document.referrer).origin===location.origin}catch(e){}if(sameOriginReferrer&&(!nav||nav.type!=='reload')){splash.remove();return}splash.classList.add('is-visible');var reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;requestAnimationFrame(function(){splash.classList.add('is-writing')});setTimeout(function(){splash.classList.remove('is-writing');splash.classList.add('is-leaving');setTimeout(function(){splash.remove()},reduced?130:210)},reduced?320:900)})();</script>`;
        const withSplashAssets = html.replace('</head>', '<link rel="preload" as="image" href="/assets/moonble-wordmark.png"/><link rel="stylesheet" href="/src/logo-writing.css"/><style>#moonble-startup-splash{position:fixed;inset:0;z-index:100001;display:none;place-items:center;overflow:hidden;background:#fff;opacity:1}#moonble-startup-splash.is-visible{display:grid}#moonble-startup-splash.is-leaving{animation:moonble-startup-fade 200ms ease-out forwards}#moonble-startup-splash svg{display:block;width:min(52vw,220px);height:auto;overflow:visible}@keyframes moonble-startup-fade{to{opacity:0;visibility:hidden}}@media(prefers-reduced-motion:reduce){#moonble-startup-splash.is-leaving{animation-duration:120ms}}</style></head>');
        return withSplashAssets.replace(/<body([^>]*)>/i, `<body$1>${splash}`);
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env };
  const url = env.VITE_SUPABASE_URL?.trim();
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (url || key) {
    if (!url || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url) || !key?.startsWith('sb_publishable_')) {
      throw new Error('Supabase 프로젝트 URL과 공개용 Publishable Key를 함께 설정해주세요. Secret/Service Role Key는 빌드할 수 없습니다.');
    }
  }
  return {
  plugins: [startupSplash(), preserveLegacyPages()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src/prd', import.meta.url)) } },
  esbuild: { jsx: 'automatic' },
  base: './',
  build: {
    rollupOptions: {
      input: {
        home: fileURLToPath(new URL('./index.html', import.meta.url)),
        notFound: fileURLToPath(new URL('./404.html', import.meta.url)),
        solve: fileURLToPath(new URL('./solve.html', import.meta.url)),
        login: fileURLToPath(new URL('./login.html', import.meta.url)),
        signup: fileURLToPath(new URL('./signup.html', import.meta.url)),
        account: fileURLToPath(new URL('./account.html', import.meta.url)),
        prd: fileURLToPath(new URL('./prd.html', import.meta.url)),
        quiz: fileURLToPath(new URL('./quiz.html', import.meta.url)),
        privacy: fileURLToPath(new URL('./privacy.html', import.meta.url)),
        terms: fileURLToPath(new URL('./terms.html', import.meta.url)),
      },
    },
  },
  };
});
