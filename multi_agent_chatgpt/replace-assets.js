#!/usr/bin/env node
/**
 * asset-map.json 을 기반으로 HTML/JS 파일의
 * Figma 임시 URL을 로컬 assets/ 경로로 일괄 교체
 *
 * 사용법: node replace-assets.js
 */

const fs   = require('fs');
const path = require('path');

const MAP_PATH = path.join(__dirname, 'asset-map.json');
const EXTS     = ['.html', '.js', '.css'];
const DIR      = __dirname;

if (!fs.existsSync(MAP_PATH)) {
  console.error('asset-map.json 이 없습니다. 먼저 download-figma-assets.js 를 실행하세요.');
  process.exit(1);
}

const assetMap = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));

// MCP asset URL → 로컬 경로 매핑 추가 (figma.com/api/mcp/asset/<uuid>)
// asset-map.json 에 mcp:<uuid> 키가 있으면 우선 사용
// 없으면 uuid 부분만 뽑아서 assets/ 안에서 파일명 검색

const assetsDir = path.join(DIR, 'assets');
const localFiles = fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir) : [];

function findLocalFile(uuid) {
  // 키에서 직접 찾기
  for (const [key, val] of Object.entries(assetMap)) {
    if (key.includes(uuid)) return val;
  }
  // assets/ 폴더에서 uuid 포함 파일 찾기
  const match = localFiles.find(f => f.includes(uuid));
  return match ? `assets/${match}` : null;
}

// 처리할 파일 목록
const files = fs.readdirSync(DIR).filter(f => EXTS.includes(path.extname(f)));

let totalReplaced = 0;

for (const file of files) {
  const filePath = path.join(DIR, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let replaced = 0;

  // figma.com/api/mcp/asset/<uuid> 패턴 교체
  content = content.replace(
    /https:\/\/www\.figma\.com\/api\/mcp\/asset\/([0-9a-f-]{36})/gi,
    (match, uuid) => {
      const local = findLocalFile(uuid);
      if (local) { replaced++; return local; }
      console.warn(`  ⚠️  매핑 없음: ${uuid}`);
      return match;
    }
  );

  // asset-map.json 의 다운로드 URL 패턴도 교체 (node/fill URL)
  for (const [key, localPath] of Object.entries(assetMap)) {
    // value가 이미 로컬 경로면 skip
    if (localPath.startsWith('assets/') || localPath.startsWith('./assets/')) continue;
    const escaped = localPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped, 'g');
    const before = content.length;
    content = content.replace(re, `assets/${path.basename(localPath)}`);
    if (content.length !== before) replaced++;
  }

  if (replaced > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ ${file}: ${replaced}곳 교체`);
    totalReplaced += replaced;
  } else {
    console.log(`  ${file}: 변경 없음`);
  }
}

console.log(`\n✅ 완료 — 총 ${totalReplaced}곳 교체`);
