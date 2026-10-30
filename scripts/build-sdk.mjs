#!/usr/bin/env node

/**
 * Copio SDK Build Script (CPO-060)
 * 
 * Produces:
 * 1. Tree-shakeable ESM bundle with code-split lazy chunks in dist/
 * 2. Standalone CDN bundle in dist/cdn.js
 * 3. Copies worker/WASM/model assets into dist/assets/
 * 4. Injects build date constant for version/licensing checks
 */

import { rm, mkdir, cp, stat } from 'fs/promises';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import * as esbuild from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');
const buildDate = new Date().toISOString();

// Stub out optional Node.js modules embedded in PDF.js / third-party libs
// so browser bundlers (Vite, Rollup, Webpack) resolve cleanly without externalizing errors.
const browserShimPlugin = {
  name: 'browser-shim',
  setup(build) {
    build.onResolve({ filter: /^(canvas|path2d|fs|http|https|url|zlib|path|stream)$/ }, (args) => {
      return { path: args.path, namespace: 'browser-shim-ns' };
    });
    build.onLoad({ filter: /.*/, namespace: 'browser-shim-ns' }, () => {
      return {
        contents: 'export default {}; export const createCanvas = () => null; export const Path2D = globalThis.Path2D || class {};',
        loader: 'js',
      };
    });
  },
};

async function buildSdk() {
  console.log('📦 Building Copio SDK...\n');
  console.log(`Build Date: ${buildDate}`);

  // 1. Clean dist/
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  // 2. Build ESM bundle with code-splitting
  console.log('\n🔨 Generating ESM chunks...');
  const esmResult = await esbuild.build({
    entryPoints: {
      index: path.join(rootDir, 'sdk/index.js'),
      core: path.join(rootDir, 'sdk/core.js'),
      scanner: path.join(rootDir, 'sdk/scanner.js'),
      sync: path.join(rootDir, 'sdk/sync.js'),
      ocr: path.join(rootDir, 'js/services/ocr-service.js'),
      export: path.join(rootDir, 'js/services/export-utils.js'),
      'adapters/index': path.join(rootDir, 'js/adapters/index.js'),
      'adapters/memory-adapter': path.join(rootDir, 'js/adapters/storage/memory-adapter.js'),
      'adapters/indexeddb-adapter': path.join(rootDir, 'js/adapters/storage/indexeddb-adapter.js'),
      'adapters/storage/index': path.join(rootDir, 'js/adapters/storage/index.js'),
      'adapters/storage/memory-adapter': path.join(rootDir, 'js/adapters/storage/memory-adapter.js'),
      'adapters/storage/indexeddb-adapter': path.join(rootDir, 'js/adapters/storage/indexeddb-adapter.js'),
      'adapters/ocr/index': path.join(rootDir, 'js/adapters/ocr/index.js'),
      'adapters/ocr/null-ocr-adapter': path.join(rootDir, 'js/adapters/ocr/null-ocr-adapter.js'),
      'adapters/ocr/tesseract-wasm-adapter': path.join(rootDir, 'js/adapters/ocr/tesseract-wasm-adapter.js'),
      'adapters/pdf/index': path.join(rootDir, 'js/adapters/pdf/index.js'),
      'adapters/pdf/null-pdf-adapter': path.join(rootDir, 'js/adapters/pdf/null-pdf-adapter.js'),
      'adapters/pdf/pdfkit-adapter': path.join(rootDir, 'js/adapters/pdf/pdfkit-adapter.js'),
      'adapters/image/index': path.join(rootDir, 'js/adapters/image/index.js'),
      'adapters/image/canvas2d-adapter': path.join(rootDir, 'js/adapters/image/canvas2d-adapter.js'),
      'adapters/image/null-image-processor-adapter': path.join(rootDir, 'js/adapters/image/null-image-processor-adapter.js'),
      'adapters/sync/index': path.join(rootDir, 'js/adapters/sync/index.js'),
      'adapters/sync/null-sync-adapter': path.join(rootDir, 'js/adapters/sync/null-sync-adapter.js'),
      'adapters/sync/peerjs-adapter': path.join(rootDir, 'js/adapters/sync/peerjs-adapter.js'),
    },
    bundle: true,
    splitting: true,
    format: 'esm',
    outdir: distDir,
    minify: true,
    sourcemap: true,
    target: ['es2022'],
    plugins: [browserShimPlugin],
    define: {
      __BUILD_DATE__: JSON.stringify(buildDate),
    },
    metafile: true,
  });

  // 3. Build standalone CDN bundle
  console.log('🌐 Generating standalone CDN bundle...');
  await esbuild.build({
    entryPoints: {
      cdn: path.join(rootDir, 'sdk/cdn.js'),
    },
    bundle: true,
    format: 'esm',
    outfile: path.join(distDir, 'cdn.js'),
    minify: true,
    sourcemap: true,
    target: ['es2022'],
    plugins: [browserShimPlugin],
    define: {
      __BUILD_DATE__: JSON.stringify(buildDate),
    },
  });

  // 4. Copy worker/WASM/model assets
  console.log('📁 Copying worker & WASM assets...');
  const distAssets = path.join(distDir, 'assets');
  const distJsLib = path.join(distDir, 'js/lib');
  await mkdir(distAssets, { recursive: true });
  await mkdir(distJsLib, { recursive: true });

  // Dedicated worker & WASM assets in dist/assets/ (CPO-060)
  const assetTargets = [
    { src: path.join(rootDir, 'js/lib/tesseract-core'), dest: path.join(distAssets, 'tesseract-core') },
    { src: path.join(rootDir, 'js/lib/tesseract-worker.min.js'), dest: path.join(distAssets, 'tesseract-worker.min.js') },
    { src: path.join(rootDir, 'js/lib/pdf.worker.min.mjs'), dest: path.join(distAssets, 'pdf.worker.min.mjs') },
    { src: path.join(rootDir, 'js/lib/pdf.min.mjs'), dest: path.join(distAssets, 'pdf.min.mjs') },
    { src: path.join(rootDir, 'assets/tessdata'), dest: path.join(distAssets, 'tessdata') },
    { src: path.join(rootDir, 'assets/icons'), dest: path.join(distAssets, 'icons') },
  ];

  for (const target of assetTargets) {
    try {
      await cp(target.src, target.dest, { recursive: true });
    } catch (e) {
      console.warn(`Warning copying ${target.src}:`, e.message);
    }
  }

  // Also populate dist/js/lib for assetBase='<path>/dist' compatibility
  const libFiles = [
    'cropper.js',
    'exifr.js',
    'jszip.min.js',
    'marked.min.js',
    'pdf.min.mjs',
    'pdf.worker.min.mjs',
    'pdfkit.js',
    'peerjs.min.js',
    'qrcode.js',
    'tesseract-worker.min.js',
    'tesseract.min.js',
  ];

  for (const file of libFiles) {
    try {
      await cp(path.join(rootDir, 'js/lib', file), path.join(distJsLib, file));
    } catch (e) {
      console.warn(`Warning copying ${file}:`, e.message);
    }
  }
  await cp(path.join(rootDir, 'js/lib/tesseract-core'), path.join(distJsLib, 'tesseract-core'), { recursive: true });

  // 5. Build TypeScript declarations & Custom Elements Manifest
  console.log('\n📝 Building TypeScript types and Custom Elements Manifest...');
  execSync('node scripts/build-types.mjs', { cwd: rootDir, stdio: 'inherit' });

  // 6. Report output chunks
  console.log('\n✅ Build complete! Distributable outputs:');
  const outputs = Object.keys(esmResult.metafile.outputs);
  for (const out of outputs) {
    const size = (esmResult.metafile.outputs[out].bytes / 1024).toFixed(2);
    console.log(`   - ${out}: ${size} KB`);
  }

  const cdnStat = await stat(path.join(distDir, 'cdn.js'));
  console.log(`   - dist/cdn.js: ${(cdnStat.size / 1024).toFixed(2)} KB (standalone CDN)`);
}

buildSdk().catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
