"""Validate handoff paths without requiring third-party packages."""
from pathlib import Path
import hashlib
import json
import re

root = Path(__file__).resolve().parents[1]
errors = []
for file in [root / 'index.html', *sorted((root / 'styles').glob('*.css'))]:
    if file.name.startswith('._'):
        continue
    text = file.read_text()
    refs = re.findall(r'(?:src|href)="([^"]+)"', text)
    refs += re.findall(r'url\([\'"]?([^\'"\)]+)', text)
    for ref in refs:
        if ref.startswith(('#', 'tel:')): continue
        if file.name == 'fonts.css' and ref.startswith(('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/web/static/woff2/', 'https://cdn.jsdelivr.net/gh/fonts-archive/Paperlogy/')) and ref.endswith('.woff2'):
            continue
        if not ref.startswith(('./', '../')):
            errors.append(f'{file.name}: non-relative path: {ref}')
        elif not (file.parent / ref).is_file():
            errors.append(f'{file.name}: missing file: {ref}')

manifest = json.loads((root / 'assets/asset-manifest.json').read_text())
for asset in manifest['assets']:
    file = root / asset['path']
    if not file.is_file() or not file.stat().st_size:
        errors.append(f'Missing or empty asset: {asset["path"]}')
    elif hashlib.sha256(file.read_bytes()).hexdigest() != asset['sha256']:
        errors.append(f'Asset changed: {asset["path"]}')

if errors:
    raise SystemExit('\n'.join(errors))
print(f'PASS: relative references and {len(manifest["assets"])} asset files')
