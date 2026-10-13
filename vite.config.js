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
  plugins: [preserveLegacyPages()],
  base: './',
  build: {
    rollupOptions: {
      input: {
        home: fileURLToPath(new URL('./index.html', import.meta.url)),
        login: fileURLToPath(new URL('./login.html', import.meta.url)),
      },
    },
  },
  };
});
