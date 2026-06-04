#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

const srcDir    = path.resolve(__dirname, '..');       // widget-launcher-src/
const serveDir  = path.resolve(srcDir, '..');          // jjn_chatGPT/
const PORT      = 8080;
const OPEN_PATH = `http://localhost:${PORT}/chatgpt-shell.html`;

console.log('\n🔧  QA 환경 시작 중...');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// 1) vite build --watch
const vite = spawn('npx', ['vite', 'build', '--watch'], {
  cwd: srcDir,
  stdio: 'pipe',
  shell: true,
});

let initialBuildDone = false;

vite.stdout.on('data', d => {
  const msg = d.toString();
  process.stdout.write('[vite] ' + msg);

  // 첫 빌드 완료 후 live-server 기동
  if (!initialBuildDone && msg.includes('built in')) {
    initialBuildDone = true;
    startLiveServer();
  }
});
vite.stderr.on('data', d => process.stderr.write('[vite] ' + d.toString()));

// 2) live-server (빌드 변경 감지 + 자동 리로드)
function startLiveServer() {
  console.log(`\n🌐  서버 시작: ${OPEN_PATH}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const server = spawn('npx', [
    'live-server', serveDir,
    `--port=${PORT}`,
    `--open=${OPEN_PATH}`,
    '--watch=widget-launcher.html,assets/widget-launcher-bundle',
    '--wait=300',
    '--no-browser',  // 직접 열기
  ], { stdio: 'inherit', shell: true, cwd: serveDir });

  // 브라우저 직접 열기
  setTimeout(() => {
    spawn('open', [OPEN_PATH], { shell: false });
  }, 1500);

  process.on('SIGINT', () => {
    console.log('\n👋  QA 환경 종료');
    vite.kill();
    server.kill();
    process.exit(0);
  });
}

vite.on('error', err => console.error('vite 오류:', err));
