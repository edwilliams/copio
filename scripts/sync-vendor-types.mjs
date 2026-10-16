import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const vendorSourceDir = path.join(rootDir, 'types', 'vendor');
const libDestDir = path.join(rootDir, 'js', 'lib');

/**
 * Synchronize vendor declaration files from types/vendor/ to js/lib/.
 * Keeps the canonical source of truth in types/vendor/ so vendor updates in js/lib/
 * will not overwrite or destroy type definitions.
 */
export function syncVendorTypes() {
  if (!fs.existsSync(vendorSourceDir)) {
    return;
  }
  if (!fs.existsSync(libDestDir)) {
    fs.mkdirSync(libDestDir, { recursive: true });
  }

  const files = fs.readdirSync(vendorSourceDir);
  for (const file of files) {
    if (file.endsWith('.d.ts') || file.endsWith('.d.mts')) {
      const srcPath = path.join(vendorSourceDir, file);
      const destPath = path.join(libDestDir, file);

      const srcContent = fs.readFileSync(srcPath);
      let needsCopy = true;
      if (fs.existsSync(destPath)) {
        const destContent = fs.readFileSync(destPath);
        if (srcContent.equals(destContent)) {
          needsCopy = false;
        }
      }

      if (needsCopy) {
        fs.writeFileSync(destPath, srcContent);
      }
    }
  }
}

// Execute directly if run as a script
if (process.argv[1] === __filename) {
  syncVendorTypes();
  console.log('Synced vendor type declarations from types/vendor/ to js/lib/');
}
