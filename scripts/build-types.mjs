#!/usr/bin/env node

import { execSync } from 'child_process';
import { copyFile, appendFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

console.log('📦 Generating TypeScript declaration files via tsc...');
execSync('npx tsc -p tsconfig.build-types.json', { cwd: rootDir, stdio: 'inherit' });

console.log('\n📜 Generating Custom Elements Manifest via @custom-elements-manifest/analyzer...');
execSync('npx cem analyze --globs "sdk/**/*.js" "js/routes/**/*.js" "js/components/**/*.js" --litelement --outdir dist', { cwd: rootDir, stdio: 'inherit' });

console.log('\n🔗 Augmenting HTMLElementTagNameMap in SDK declaration bundle...');
await copyFile(path.join(rootDir, 'types/copio.d.ts'), path.join(rootDir, 'dist/types/sdk/elements.d.ts'));
await appendFile(path.join(rootDir, 'dist/types/sdk/index.d.ts'), '\nimport "./elements.js";\n');

console.log('\n✅ Type definitions & Custom Elements Manifest built successfully!');
