#!/usr/bin/env node

/**
 * CI Smoke Test for Framework Examples (CPO-064)
 *
 * Packs the local @copio/sdk tarball, installs it into each example
 * (vanilla, react, vue, angular) without modifying package.json/lockfiles,
 * and verifies `npm run build` succeeds for every example.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const examplesDir = path.join(rootDir, 'examples');
const examples = ['vanilla', 'react', 'vue', 'angular'];

function run(cmd, cwd) {
  console.log(`\n$ (${path.relative(rootDir, cwd) || '.'}) ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

async function main() {
  if (!fs.existsSync(path.join(rootDir, 'dist', 'index.js'))) {
    run('npm run build:sdk', rootDir);
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'copio-examples-'));
  try {
    const packOutput = execSync(`npm pack --pack-destination "${tmpDir}"`, {
      cwd: rootDir,
      encoding: 'utf8',
    }).trim();
    const tgzName = packOutput.split('\n').pop()?.trim();
    if (!tgzName) {
      throw new Error('Failed to determine packed tarball filename.');
    }
    const tarballPath = path.join(tmpDir, tgzName);
    console.log(`📦 Packed local @copio/sdk tarball: ${tarballPath}`);

    for (const name of examples) {
      const exDir = path.join(examplesDir, name);
      console.log(`\n🧪 Testing example: examples/${name}`);

      if (!fs.existsSync(path.join(exDir, 'node_modules'))) {
        run('npm install --no-audit --no-fund', exDir);
      }
      run(`npm install --no-save --no-package-lock --no-audit --no-fund "${tarballPath}"`, exDir);
      run('npm run build', exDir);

      const distIndex = path.join(exDir, 'dist', 'index.html');
      const distBrowserIndex = path.join(exDir, 'dist', 'browser', 'index.html');
      if (!fs.existsSync(distIndex) && !fs.existsSync(distBrowserIndex)) {
        throw new Error(`Build output missing index.html in examples/${name}/dist`);
      }
      console.log(`✅ examples/${name} built successfully.`);
    }

    console.log('\n🎉 All framework examples built cleanly!');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error('❌ Example smoke test failed:', err);
  process.exit(1);
});
