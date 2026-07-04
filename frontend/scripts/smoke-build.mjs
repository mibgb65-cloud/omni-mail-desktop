import {existsSync, readFileSync, statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const indexPath = path.join(dist, 'index.html');

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

assert(existsSync(indexPath), 'dist/index.html is missing; run npm run build first.');

const indexHtml = readFileSync(indexPath, 'utf8');
assert(indexHtml.includes('id="root"'), 'dist/index.html is missing the React root node.');

const assetPaths = [...indexHtml.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((value) => value.startsWith('/assets/'))
    .map((value) => path.join(dist, value.replace(/^\//, '')));

assert(assetPaths.some((assetPath) => assetPath.endsWith('.js')), 'dist/index.html does not reference a JS asset.');
assert(assetPaths.some((assetPath) => assetPath.endsWith('.css')), 'dist/index.html does not reference a CSS asset.');

for (const assetPath of assetPaths) {
    assert(existsSync(assetPath), `referenced asset is missing: ${path.relative(root, assetPath)}`);
    assert(statSync(assetPath).size > 0, `referenced asset is empty: ${path.relative(root, assetPath)}`);
}

const jsBundle = assetPaths
    .filter((assetPath) => assetPath.endsWith('.js'))
    .map((assetPath) => readFileSync(assetPath, 'utf8'))
    .join('\n');
const cssBundle = assetPaths
    .filter((assetPath) => assetPath.endsWith('.css'))
    .map((assetPath) => readFileSync(assetPath, 'utf8'))
    .join('\n');

const requiredUiMarkers = [
    '工作台设置',
    '搜索中心',
    '联系人中心',
    '附件中心',
    '操作队列',
    '本机隐私状态',
    '版本更新',
    '更新策略'
];
const requiredStyleMarkers = [
    'workspace-search-page',
    'workspace-queue-page',
    'search-scope-panel',
    'queue-task-item',
    'privacy-status-grid'
];

for (const marker of requiredUiMarkers) {
    assert(jsBundle.includes(marker), `production JS is missing UI marker: ${marker}`);
}

for (const marker of requiredStyleMarkers) {
    assert(cssBundle.includes(marker), `production CSS is missing style marker: ${marker}`);
}

console.log(`Frontend smoke check passed: ${assetPaths.length} assets and ${requiredUiMarkers.length} UI markers.`);
