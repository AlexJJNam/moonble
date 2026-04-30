#!/usr/bin/env node
/**
 * Figma MCP에서 받은 최신 애셋 URL을 assets/ 폴더에 다운로드
 * 실행: node fetch-assets-now.js
 */

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

// ── 현재 유효한 Figma MCP 애셋 URLs ────────────────────────
// (node 44:3561 — 데스크톱 전체 화면)
const ASSETS_44_3561 = {
  'logo1':                       'assets/logo1.png',
  'download1':                   'assets/download1.jpg',
  'avatar':                      'assets/avatar.png',
  'icon-chevron-down':           'assets/icon-chevron-down.svg',
  'icon-share':                  'assets/icon-share.svg',
  'icon-dots-horizontal':        'assets/icon-dots-horizontal.svg',
  'icon-agent-valuation':        'assets/icon-agent-valuation.svg',
  'icon-check':                  'assets/icon-check.svg',
  'icon-agent-news':             'assets/icon-agent-news.svg',
  'icon-loading-news':           'assets/icon-loading-news.svg',
  'icon-agent-factor':           'assets/icon-agent-factor.svg',
  'icon-loading-factor':         'assets/icon-loading-factor.svg',
  'icon-agent-report':           'assets/icon-agent-report.svg',
  'icon-loading-report':         'assets/icon-loading-report.svg',
  'icon-copy':                   'assets/icon-copy.svg',
  'icon-thumb-up':               'assets/icon-thumb-up.svg',
  'icon-thumb-down':             'assets/icon-thumb-down.svg',
  'icon-share2':                 'assets/icon-share2.svg',
  'icon-regenerate':             'assets/icon-regenerate.svg',
  'icon-attach':                 'assets/icon-attach.svg',
  'icon-search':                 'assets/icon-search.svg',
  'icon-voice':                  'assets/icon-voice.svg',
  'openai-logo':                 'assets/openai-logo.svg',
  'icon-new-chat':               'assets/icon-new-chat.svg',
  'icon-search-sidebar':         'assets/icon-search-sidebar.svg',
  'icon-library':                'assets/icon-library.svg',
  'safari-window-controls':      'assets/safari-window-controls.svg',
};

// (node 43:2315 — 모바일 카드)
const ASSETS_43_2315 = {
  'samsung-thumb':               'assets/samsung-thumb.jpg',
  'icon-agent-valuation-m':      'assets/icon-agent-valuation-m.svg',
  'icon-check-m':                'assets/icon-check-m.svg',
  'icon-agent-news-m':           'assets/icon-agent-news-m.svg',
  'icon-agent-factor-m':         'assets/icon-agent-factor-m.svg',
  'icon-check2-m':               'assets/icon-check2-m.svg',
  'icon-agent-report-m':         'assets/icon-agent-report-m.svg',
  'icon-voice-bold':             'assets/icon-voice-bold.svg',
};

// (node 93:4206 — iOS 에이전트 선택 게이트 - 모바일)
const ASSETS_93_4206 = {
  'gate-logo1-ios':              'assets/gate-logo1-ios.png',
  'iphone15-bezel':              'assets/iphone15-bezel.png',
  'gate-icon-agent-valuation':   'assets/gate-icon-agent-valuation.svg',
  'gate-icon-agent-news':        'assets/gate-icon-agent-news.svg',
  'gate-icon-agent-factor':      'assets/gate-icon-agent-factor.svg',
  'gate-icon-agent-report':      'assets/gate-icon-agent-report.svg',
  'gate-icon-fundamental':       'assets/gate-icon-fundamental.svg',
  'gate-icon-copy-ios':          'assets/gate-icon-copy-ios.svg',
  'gate-icon-speaker':           'assets/gate-icon-speaker.svg',
  'gate-icon-thumb-up-ios':      'assets/gate-icon-thumb-up-ios.svg',
  'gate-icon-thumb-down-ios':    'assets/gate-icon-thumb-down-ios.svg',
  'gate-icon-regenerate-ios':    'assets/gate-icon-regenerate-ios.svg',
  'gate-icon-share-ios':         'assets/gate-icon-share-ios.svg',
  'gate-icon-attach-ios':        'assets/gate-icon-attach-ios.svg',
  'gate-icon-mic':               'assets/gate-icon-mic.svg',
  'gate-icon-voice-send':        'assets/gate-icon-voice-send.svg',
  'status-cellular':             'assets/status-cellular.svg',
  'status-wifi':                 'assets/status-wifi.svg',
  'status-battery':              'assets/status-battery.svg',
  'nav-sidebar-menu':            'assets/nav-sidebar-menu.svg',
  'nav-chevron-right':           'assets/nav-chevron-right.svg',
  'nav-compose':                 'assets/nav-compose.svg',
  'nav-dots-more':               'assets/nav-dots-more.svg',
};

// (node 93:5797 — Desktop Safari 에이전트 선택 게이트)
const ASSETS_93_5797 = {
  'gate-logo1-desktop':          'assets/gate-logo1-desktop.png',
  'gate-avatar-desktop':         'assets/gate-avatar-desktop.png',
  'gate-icon-chevron-down-d':    'assets/gate-icon-chevron-down-d.svg',
  'gate-icon-share-d':           'assets/gate-icon-share-d.svg',
  'gate-icon-dots-d':            'assets/gate-icon-dots-d.svg',
  'gate-agent-valuation-d':      'assets/gate-agent-valuation-d.svg',
  'gate-agent-news-d':           'assets/gate-agent-news-d.svg',
  'gate-agent-factor-d':         'assets/gate-agent-factor-d.svg',
  'gate-agent-report-d':         'assets/gate-agent-report-d.svg',
  'gate-fundamental-d':          'assets/gate-fundamental-d.svg',
  'gate-icon-copy-d':            'assets/gate-icon-copy-d.svg',
  'gate-icon-thumb-up-d':        'assets/gate-icon-thumb-up-d.svg',
  'gate-icon-thumb-down-d':      'assets/gate-icon-thumb-down-d.svg',
  'gate-icon-share2-d':          'assets/gate-icon-share2-d.svg',
  'gate-icon-regenerate-d':      'assets/gate-icon-regenerate-d.svg',
  'gate-icon-attach-d':          'assets/gate-icon-attach-d.svg',
  'gate-icon-search-d':          'assets/gate-icon-search-d.svg',
  'gate-icon-voice-d':           'assets/gate-icon-voice-d.svg',
  'gate-openai-logo-d':          'assets/gate-openai-logo-d.svg',
  'gate-icon-new-chat-d':        'assets/gate-icon-new-chat-d.svg',
  'gate-icon-search-sidebar-d':  'assets/gate-icon-search-sidebar-d.svg',
  'gate-icon-library-d':         'assets/gate-icon-library-d.svg',
  'gate-safari-controls-d':      'assets/gate-safari-controls-d.svg',
};

const ALL_ASSETS = { ...ASSETS_44_3561, ...ASSETS_43_2315, ...ASSETS_93_4206, ...ASSETS_93_5797 };

// ── 다운로드 유틸 ──────────────────────────────────────────
function download(fileUrl, destPath, redirectCount) {
  redirectCount = redirectCount || 0;
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error('리다이렉트 횟수 초과'));
    const parsed = url.parse(fileUrl);
    const lib = parsed.protocol === 'https:' ? https : http;
    lib.get(fileUrl, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return resolve(download(res.headers.location, destPath, redirectCount + 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const out = fs.createWriteStream(destPath);
      res.pipe(out);
      out.on('finish', () => out.close(resolve));
      out.on('error', reject);
    }).on('error', reject);
  });
}

function extFromHeaders(headers, fallback) {
  const ct = (headers['content-type'] || '').split(';')[0].trim();
  const map = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg',
    'image/svg+xml': 'svg', 'image/webp': 'webp', 'image/gif': 'gif',
  };
  return map[ct] || fallback || 'png';
}

function head(fileUrl) {
  return new Promise((resolve) => {
    const parsed = url.parse(fileUrl);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request({ hostname: parsed.hostname, path: parsed.path, method: 'HEAD' }, (res) => {
      resolve(res.headers);
    });
    req.on('error', () => resolve({}));
    req.end();
  });
}

// ── 메인 ──────────────────────────────────────────────────
(async () => {
  const assetsDir = path.join(__dirname, 'assets');
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir);

  const entries = Object.entries(ALL_ASSETS);
  const assetMap = {}; // uuid → local path (for replace-assets.js)
  let ok = 0, fail = 0;

  console.log(`\n⬇️  Figma 애셋 다운로드 시작 (총 ${entries.length}개)...\n`);

  for (const [name, assetUrl] of entries) {
    const uuid = assetUrl.replace('https://www.figma.com/api/mcp/asset/', '');
    const tmpPath = path.join(assetsDir, `${name}.tmp`);

    process.stdout.write(`  ${name} ... `);
    try {
      // 다운로드 (임시 파일로)
      await download(assetUrl, tmpPath);

      // Content-Type으로 확장자 결정
      const stat = fs.statSync(tmpPath);
      let ext = 'png';
      if (stat.size > 0) {
        const buf = Buffer.alloc(4);
        const fd = fs.openSync(tmpPath, 'r');
        fs.readSync(fd, buf, 0, 4, 0);
        fs.closeSync(fd);
        if (buf[0] === 0x89 && buf[1] === 0x50) ext = 'png';
        else if (buf[0] === 0xFF && buf[1] === 0xD8) ext = 'jpg';
        else if (buf.toString('ascii', 0, 4) === '<svg' || buf.toString('ascii', 0, 1) === '<') ext = 'svg';
        else if (buf.toString('ascii', 0, 4) === 'RIFF') ext = 'webp';
      }

      const finalName = `${name}.${ext}`;
      const finalPath = path.join(assetsDir, finalName);
      fs.renameSync(tmpPath, finalPath);

      assetMap[uuid] = `assets/${finalName}`;
      console.log(`✓  (${(stat.size / 1024).toFixed(1)}KB → ${finalName})`);
      ok++;
    } catch (e) {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      console.log(`✗  ${e.message}`);
      fail++;
    }
  }

  // asset-map.json 저장
  const mapPath = path.join(__dirname, 'asset-map.json');
  const existing = fs.existsSync(mapPath) ? JSON.parse(fs.readFileSync(mapPath, 'utf8')) : {};
  fs.writeFileSync(mapPath, JSON.stringify({ ...existing, ...assetMap }, null, 2), 'utf8');

  console.log(`\n✅ 완료 — 성공 ${ok}개 / 실패 ${fail}개`);
  console.log(`📋 asset-map.json 업데이트 완료`);
  if (ok > 0) {
    console.log('\n다음 단계: node replace-assets.js');
  }
})();
