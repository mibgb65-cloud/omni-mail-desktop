import {readFileSync} from 'node:fs';

const lockPath = process.argv[2];
if (!lockPath) {
    throw new Error('package-lock path is required');
}

const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
const packages = Object.entries(lock.packages || {})
    .filter(([packagePath, value]) => packagePath && value?.version)
    .map(([packagePath, value]) => ({
        name: packagePath.replace(/^node_modules\//, ''),
        version: String(value.version)
    }));

process.stdout.write(JSON.stringify(packages));
