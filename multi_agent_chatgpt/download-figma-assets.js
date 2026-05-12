#!/usr/bin/env node
/**
 * Figma 애셋 자동 다운로드 스크립트
 *
 * 사용법:
 *   node download-figma-assets.js <FIGMA_URL> [FIGMA_TOKEN]
 *
 * 환경변수로 토큰 설정 가능:
 *   set FIGMA_TOKEN=figd_xxxxxxxxxxxxxxxx
 *   node download-figma-assets.js https://www.figma.com/design/XXXX/...
 *
 * 결과:
 *   - assets/ 폴더에 이미지 저장
 *   - asset-map.json 에 UUID → 로컬경로 매핑 저장
 */

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

// ── 인자 파싱 ──────────────────────────────────────────────
const figmaUrl  = process.argv[2];
const tokenArg  = process.argv[3];
const TOKEN     = tokenArg || process.env.FIGMA_TOKEN;

if (!figmaUrl) {
  console.error('사용법: node download-figma-assets.js <FIGMA_URL> [FIGMA_TOKEN]');
  process.exit(1);
}
if (!TOKEN) {
  console.error('Figma Personal Access Token이 필요합니다.');
  console.error('  방법1: node download-figma-assets.js <URL> figd_xxx...');
  console.error('  방법2: set FIGMA_TOKEN=figd_xxx...  (환경변수)');
  console.error('\n토큰 발급: https://www.figma.com/settings → Personal access tokens');
  process.exit(1);
}

// ── Figma URL에서 fileKey / nodeId 추출 ───────────────────
function parseFileKey(figmaUrl) {
  // /design/:fileKey/ 또는 /file/:fileKey/
  const m = figmaUrl.match(/figma\.com\/(?:design|file)\/([A-Za-z0-9_-]+)/);
  if (!m) throw new Error('Figma URL에서 fileKey를 찾을 수 없습니다: ' + figmaUrl);
  return m[1];
}

function parseNodeId(figmaUrl) {
  const parsed = url.parse(figmaUrl, true);
  const nodeId = parsed.query['node-id'];
  return nodeId ? nodeId.replace(/-/g, ':') : null;
}

// ── HTTP GET (Promise) ─────────────────────────────────────
function get(reqUrl, headers) {
  return new Promise((resolve, reject) => {
    const parsed = url.parse(reqUrl);
    const lib = parsed.protocol === 'https:' ? https : http;
    const opts = { hostname: parsed.hostname, path: parsed.path, headers: headers || {} };
    lib.get(opts, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return resolve(get(res.headers.location, headers));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks), headers: res.headers }));
    }).on('error', reject);
  });
}

// ── 파일 다운로드 ──────────────────────────────────────────
function download(fileUrl, destPath) {
  return new Promise((resolve, reject) => {
    const parsed = url.parse(fileUrl);
    const lib = parsed.protocol === 'https:' ? https : http;
    lib.get(fileUrl, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return resolve(download(res.headers.location, destPath));
      }
      const out = fs.createWriteStream(destPath);
      res.pipe(out);
      out.on('finish', () => out.close(resolve));
      out.on('error', reject);
    }).on('error', reject);
  });
}

// ── Figma API 호출 ─────────────────────────────────────────
const API = 'https://api.figma.com/v1';
const HEADERS = { 'X-Figma-Token': TOKEN };

async function getFile(fileKey) {
  console.log(`\n📄 Figma 파일 로드 중: ${fileKey}`);
  const res = await get(`${API}/files/${fileKey}?depth=3`, HEADERS);
  if (res.status !== 200) throw new Error(`Figma API 오류 ${res.status}: ${res.body.toString()}`);
  return JSON.parse(res.body.toString());
}

async function getImageFills(fileKey) {
  console.log('🖼  이미지 Fill 목록 요청 중...');
  const res = await get(`${API}/files/${fileKey}/images`, HEADERS);
  if (res.status !== 200) throw new Error(`이미지 Fill API 오류 ${res.status}: ${res.body.toString()}`);
  return JSON.parse(res.body.toString()); // { meta: { images: { hash: url } } }
}

async function getImages(fileKey, nodeIds, format = 'png', scale = 2) {
  const ids = nodeIds.join(',');
  const reqUrl = `${API}/images/${fileKey}?ids=${encodeURIComponent(ids)}&format=${format}&scale=${scale}`;
  console.log(`  → /images API 호출 (${nodeIds.length}개 노드, ${format}@${scale}x)`);
  const res = await get(reqUrl, HEADERS);
  if (res.status !== 200) throw new Error(`Images API 오류 ${res.status}: ${res.body.toString()}`);
  return JSON.parse(res.body.toString()); // { images: { nodeId: url } }
}

// ── 노드 트리에서 이미지 있는 노드 ID 수집 ────────────────
function collectImageNodes(node, results = []) {
  if (!node) return results;
  const hasFill = node.fills && node.fills.some(f => f.type === 'IMAGE');
  if (hasFill) results.push(node.id);
  if (node.children) node.children.forEach(c => collectImageNodes(c, results));
  return results;
}

// ── 확장자 결정 ────────────────────────────────────────────
function extFromUrl(imgUrl) {
  const clean = imgUrl.split('?')[0];
  const m = clean.match(/\.(png|jpg|jpeg|svg|webp)$/i);
  return m ? m[1].toLowerCase() : 'png';
}

// ── 메인 ──────────────────────────────────────────────────
(async () => {
  try {
    const fileKey = parseFileKey(figmaUrl);
    const nodeId  = parseNodeId(figmaUrl);

    // 출력 폴더
    const assetsDir = path.join(__dirname, 'assets');
    if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir);

    // 1) 파일 트리 가져와서 이미지 노드 수집
    const fileData   = await getFile(fileKey);
    const rootNode   = nodeId
      ? findNode(fileData.document, nodeId)
      : fileData.document;

    const imageNodes = collectImageNodes(rootNode);
    console.log(`\n🔍 이미지 노드 발견: ${imageNodes.length}개`);

    // 2) imageFills (hash → CDN URL) 가져오기
    const fillsRes = await getImageFills(fileKey);
    const fillMap  = (fillsRes.meta && fillsRes.meta.images) || {};
    const fillUrls = Object.values(fillMap).filter(Boolean);
    console.log(`   imagesFill 해시: ${Object.keys(fillMap).length}개`);

    // 3) 노드별 렌더 URL 가져오기 (청크 처리)
    const nodeUrlMap = {}; // nodeId → download URL
    const CHUNK = 50;
    for (let i = 0; i < imageNodes.length; i += CHUNK) {
      const chunk = imageNodes.slice(i, i + CHUNK);
      const resp  = await getImages(fileKey, chunk, 'png', 2);
      Object.assign(nodeUrlMap, resp.images || {});
    }

    // 4) 다운로드 — nodeId 기반
    const assetMap = {};
    let count = 0;

    const allEntries = [
      ...Object.entries(nodeUrlMap).map(([id, u]) => ({ key: 'node:' + id, dlUrl: u, name: 'node_' + id.replace(':', '-') })),
      ...Object.entries(fillMap).map(([hash, u]) => ({ key: 'fill:' + hash, dlUrl: u, name: 'fill_' + hash })),
    ].filter(e => e.dlUrl);

    console.log(`\n⬇️  다운로드 시작 (총 ${allEntries.length}개)...`);

    for (const entry of allEntries) {
      try {
        const ext  = extFromUrl(entry.dlUrl);
        const file = `${entry.name}.${ext}`;
        const dest = path.join(assetsDir, file);
        process.stdout.write(`  [${++count}/${allEntries.length}] ${file} ... `);
        await download(entry.dlUrl, dest);
        assetMap[entry.key] = `assets/${file}`;
        console.log('✓');
      } catch (e) {
        console.log(`실패 (${e.message})`);
      }
    }

    // 5) 매핑 저장
    const mapPath = path.join(__dirname, 'asset-map.json');
    fs.writeFileSync(mapPath, JSON.stringify(assetMap, null, 2), 'utf8');
    console.log(`\n✅ 완료! assets/ 폴더에 ${count}개 저장`);
    console.log(`📋 매핑 파일: asset-map.json`);
    console.log('\n다음 단계: node replace-assets.js 로 HTML 내 URL을 로컬 경로로 교체하세요.');

  } catch (e) {
    console.error('\n❌ 오류:', e.message);
    process.exit(1);
  }
})();

// ── 노드 탐색 헬퍼 ────────────────────────────────────────
function findNode(node, targetId) {
  if (!node) return null;
  const normId = targetId.replace(/-/g, ':');
  if (node.id === normId || node.id === targetId) return node;
  if (node.children) {
    for (const c of node.children) {
      const found = findNode(c, targetId);
      if (found) return found;
    }
  }
  return null;
}
