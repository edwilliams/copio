#!/usr/bin/env node

/**
 * Copio Bundle Size Budget & CI Check (CPO-066)
 * Measures bundle chunks and enforces gzipped size budgets.
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');

// Budgets in Kilobytes (KB)
const BUDGETS = {
  core: {
    entry: path.join(distDir, 'core.js'),
    maxGzipKb: 80,
    label: 'Core (headless domain + storage, no OCR/PDF/Sync)',
  },
  scanner: {
    entry: path.join(distDir, 'scanner.js'),
    maxGzipKb: 175,
    label: 'Scanner (UI elements)',
  },
  sync: {
    entry: path.join(distDir, 'sync.js'),
    maxGzipKb: 60,
    label: 'Sync (P2P WebRTC)',
  },
  cdn: {
    entry: path.join(distDir, 'cdn.js'),
    maxGzipKb: 200,
    label: 'Standalone CDN Bundle',
  },
};

function getTransitiveChunkFiles(entryFile) {
  if (!fs.existsSync(entryFile)) {
    throw new Error(`Entry file does not exist: ${entryFile}`);
  }
  const visited = new Set();
  const queue = [entryFile];

  while (queue.length > 0) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);

    const content = fs.readFileSync(current, 'utf-8');
    const importMatches = [
      ...content.matchAll(/from\s*["'](\.\/[^"']+)["']/g),
      ...content.matchAll(/import\s*\(["'](\.\/[^"']+)["']\)/g),
    ];

    for (const match of importMatches) {
      const relPath = match[1];
      const resolved = path.resolve(path.dirname(current), relPath);
      // Try resolving with .js extension if missing
      const candidates = [resolved, `${resolved}.js`];
      for (const cand of candidates) {
        if (fs.existsSync(cand) && !visited.has(cand)) {
          queue.push(cand);
          break;
        }
      }
    }
  }

  return Array.from(visited);
}

function measureBundle(entryPath) {
  const files = getTransitiveChunkFiles(entryPath);
  let totalRawBytes = 0;
  let totalGzipBytes = 0;

  for (const file of files) {
    const buffer = fs.readFileSync(file);
    totalRawBytes += buffer.length;
    totalGzipBytes += zlib.gzipSync(buffer, { level: 9 }).length;
  }

  return {
    files,
    rawKb: totalRawBytes / 1024,
    gzipKb: totalGzipBytes / 1024,
  };
}

function checkBudgets() {
  console.log('📊 Evaluating Copio SDK Bundle Size Budgets...\n');

  if (!fs.existsSync(distDir)) {
    console.error('❌ dist/ directory not found. Please run "npm run build:sdk" first.');
    process.exit(1);
  }

  let failed = false;

  console.log('-----------------------------------------------------------------------------------------------------');
  console.log(
    'Target'.padEnd(12) +
    'Gzip (KB)'.padStart(12) +
    'Budget (KB)'.padStart(14) +
    'Raw (KB)'.padStart(12) +
    'Chunks'.padStart(8) +
    '  Status'
  );
  console.log('-----------------------------------------------------------------------------------------------------');

  for (const [key, config] of Object.entries(BUDGETS)) {
    try {
      const result = measureBundle(config.entry);
      const isPassed = result.gzipKb <= config.maxGzipKb;
      const statusIcon = isPassed ? '✅ PASS' : '❌ FAIL';

      if (!isPassed) {
        failed = true;
      }

      console.log(
        key.padEnd(12) +
        result.gzipKb.toFixed(2).padStart(12) +
        config.maxGzipKb.toFixed(2).padStart(14) +
        result.rawKb.toFixed(2).padStart(12) +
        String(result.files.length).padStart(8) +
        `  ${statusIcon} (${config.label})`
      );
    } catch (err) {
      console.error(`❌ Failed to measure ${key}:`, err.message);
      failed = true;
    }
  }

  console.log('-----------------------------------------------------------------------------------------------------\n');

  if (failed) {
    console.error('❌ One or more bundle size budgets exceeded!');
    process.exit(1);
  } else {
    console.log('🎉 All bundle size budgets passed!\n');
  }
}

checkBudgets();
