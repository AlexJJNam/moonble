import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

const OUT_DIR   = path.resolve(__dirname, '..');
const BUNDLE_JS = 'assets/widget-launcher-bundle/widget-launcher.js';

const finalizePlugin = {
  name: 'finalize-widget-launcher',
  closeBundle() {
    const src  = path.join(OUT_DIR, 'index.html');
    const dest = path.join(OUT_DIR, 'widget-launcher.html');
    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>런처 위젯</title>
</head>
<body>
  <div id="root"></div>
  <script src="./${BUNDLE_JS}"></script>
</body>
</html>`;
    if (fs.existsSync(src)) fs.unlinkSync(src);
    fs.writeFileSync(dest, html, 'utf8');
    console.log('[finalize] widget-launcher.html written');
  }
};

export default defineConfig({
  plugins: [react(), finalizePlugin],
  base: './',
  publicDir: path.resolve(__dirname, 'public'),
  build: {
    outDir: OUT_DIR,
    emptyOutDir: false,
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html'),
      output: {
        format: 'iife',
        name: 'WidgetLauncher',
        entryFileNames: BUNDLE_JS,
        chunkFileNames:  'assets/widget-launcher-bundle/[name].js',
        assetFileNames:  'assets/widget-launcher-bundle/[name][extname]',
      }
    }
  }
});
