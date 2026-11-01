#!/usr/bin/env node

/**
 * Repeatable export/sync script for Copio Cards (CPO-049)
 * 
 * Exports the canonical, self-contained <copio-scanner> bundle from @copio/sdk (dist/scanner.js)
 * into copio-cards/vendor/copio/scanner.js with zero manual patching required.
 */

import { copyFile, stat, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const defaultCardsDir = path.resolve(rootDir, '../copio-cards');
const targetCardsDir = process.env.COPIO_CARDS_DIR || defaultCardsDir;
const distScanner = path.join(rootDir, 'dist/scanner.js');
const vendorCopioDir = path.join(targetCardsDir, 'vendor/copio');
const targetScanner = path.join(vendorCopioDir, 'scanner.js');

async function exportToCards() {
  console.log('🔄 Exporting <copio-scanner> to Copio Cards...\n');

  if (!existsSync(targetCardsDir)) {
    console.error(`❌ Copio Cards directory not found at: ${targetCardsDir}`);
    console.error('Set COPIO_CARDS_DIR environment variable if it is located elsewhere.');
    process.exit(1);
  }

  // Ensure fresh build of SDK
  console.log('📦 Ensuring SDK is built...');
  execSync('npm run build:sdk', { cwd: rootDir, stdio: 'inherit' });

  if (!existsSync(distScanner)) {
    console.error(`❌ dist/scanner.js not found at: ${distScanner}`);
    process.exit(1);
  }

  await mkdir(vendorCopioDir, { recursive: true });
  await copyFile(distScanner, targetScanner);

  const scannerStat = await stat(targetScanner);
  console.log(`\n✅ Successfully exported canonical <copio-scanner> bundle to:`);
  console.log(`   ${targetScanner} (${(scannerStat.size / 1024).toFixed(2)} KB)`);
}

exportToCards().catch((err) => {
  console.error('❌ Export failed:', err);
  process.exit(1);
});
