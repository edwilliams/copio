#!/usr/bin/env node

/**
 * CI Smoke Test for Framework Examples (CPO-064)
 *
 * Packs the local @copio/sdk tarball, installs it into each example
 * (vanilla, react, vue, angular) without modifying package.json/lockfiles,
 * verifies `npm run build` succeeds, and verifies `npm run dev` serves
 * the app and entry modules cleanly without optimizeDeps/bundler errors.
 */

import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const examplesDir = path.join(rootDir, 'examples');

const EXAMPLES = [
  { name: 'vanilla', port: 4173, entryPaths: ['/@vite/client', '/src/main.js'] },
  { name: 'react', port: 4174, entryPaths: ['/@vite/client', '/src/main.tsx'] },
  { name: 'vue', port: 4175, entryPaths: ['/@vite/client', '/src/main.ts'] },
  { name: 'angular', port: 4176, entryPaths: ['/main.js'] },
];

function run(cmd, cwd) {
  console.log(`\n$ (${path.relative(rootDir, cwd) || '.'}) ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

async function waitForHttp(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
    } catch {
      // Server still starting
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function verifyDevServer(exDir, { name, port, entryPaths }) {
  console.log(`🚀 Verifying dev server for examples/${name} on port ${port}...`);
  const proc = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: exDir,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let logs = '';
  proc.stdout.on('data', (d) => { logs += d.toString(); });
  proc.stderr.on('data', (d) => { logs += d.toString(); });

  const killGroup = (signal) => {
    try {
      process.kill(-proc.pid, signal);
    } catch {
      try {
        proc.kill(signal);
      } catch {
        // Already exited
      }
    }
  };

  try {
    const baseUrl = `http://127.0.0.1:${port}`;
    let indexRes;
    try {
      indexRes = await waitForHttp(`${baseUrl}/`);
    } catch (err) {
      throw new Error(`${err.message} for examples/${name}\n${logs}`);
    }
    const html = await indexRes.text();
    if (!html.includes('<html') && !html.includes('<!doctype html')) {
      throw new Error(`Unexpected index.html response from examples/${name}`);
    }

    for (const p of entryPaths) {
      const res = await fetch(`${baseUrl}${p}`);
      if (!res.ok) {
        throw new Error(`Dev server failed for ${p} (${res.status}) in examples/${name}\n${logs}`);
      }
      await res.text();
    }

    // For Vite examples, also fetch the SDK entry and its transformed chunk modules
    // to exercise vite:import-analysis on every pre-bundled SDK chunk.
    if (name !== 'angular') {
      const sdkEntryRes = await fetch(`${baseUrl}/node_modules/@copio/sdk/dist/index.js`);
      if (!sdkEntryRes.ok) {
        throw new Error(`Dev server failed for @copio/sdk/dist/index.js (${sdkEntryRes.status}) in examples/${name}\n${logs}`);
      }
      const sdkEntryBody = await sdkEntryRes.text();
      const chunkMatches = [...sdkEntryBody.matchAll(/\/node_modules\/@copio\/sdk\/dist\/chunk-[A-Za-z0-9]+\.js/g)];
      const chunkPaths = [...new Set(chunkMatches.map((m) => m[0]))];
      for (const chunkPath of chunkPaths) {
        const chunkRes = await fetch(`${baseUrl}${chunkPath}`);
        if (!chunkRes.ok) {
          throw new Error(`Dev server failed for ${chunkPath} (${chunkRes.status}) in examples/${name}\n${logs}`);
        }
        await chunkRes.text();
      }
    }

    // Verify /copio-sdk lazy runtime asset serving works in dev mode
    const assetRes = await fetch(`${baseUrl}/copio-sdk/js/lib/pdfkit.js`);
    if (!assetRes.ok) {
      throw new Error(`Dev server failed to serve /copio-sdk/js/lib/pdfkit.js (${assetRes.status}) in examples/${name}`);
    }

    if (logs.includes('[ERROR]') || logs.includes('optimizeDeps') || logs.includes('Failed to load source map')) {
      throw new Error(`Dev server logged bundler errors for examples/${name}:\n${logs}`);
    }

    console.log(`✅ examples/${name} dev server responded cleanly.`);
  } finally {
    killGroup('SIGTERM');
    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        killGroup('SIGKILL');
        proc.stdout.destroy();
        proc.stderr.destroy();
        resolve();
      }, 2000);
      proc.once('exit', () => {
        clearTimeout(timer);
        proc.stdout.destroy();
        proc.stderr.destroy();
        resolve();
      });
    });
  }
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

    for (const ex of EXAMPLES) {
      const exDir = path.join(examplesDir, ex.name);
      console.log(`\n🧪 Testing example: examples/${ex.name}`);

      if (!fs.existsSync(path.join(exDir, 'node_modules'))) {
        run('npm install --no-audit --no-fund', exDir);
      }
      run(`npm install --no-save --no-package-lock --no-audit --no-fund "${tarballPath}"`, exDir);
      run('npm run build', exDir);

      const distIndex = path.join(exDir, 'dist', 'index.html');
      const distBrowserIndex = path.join(exDir, 'dist', 'browser', 'index.html');
      if (!fs.existsSync(distIndex) && !fs.existsSync(distBrowserIndex)) {
        throw new Error(`Build output missing index.html in examples/${ex.name}/dist`);
      }
      console.log(`✅ examples/${ex.name} built successfully.`);

      await verifyDevServer(exDir, ex);
    }

    console.log('\n🎉 All framework examples built and served cleanly!');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error('❌ Example smoke test failed:', err);
  process.exit(1);
});
