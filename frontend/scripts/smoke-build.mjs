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

console.log(`Frontend smoke check passed: ${assetPaths.length} assets referenced by dist/index.html.`);
