import path from 'path';
import { readdir, writeFile, readFile } from 'fs/promises';
import { relative } from 'path';
import resolve from 'rollup-plugin-node-resolve';
import copy from 'rollup-plugin-copy';
import css from 'rollup-plugin-css-only';
import { terser } from 'rollup-plugin-terser';

const _COPIO_COMPONENTS = [
  'copio-app',
  'copio-loader',
  'copio-header',
  'copio-row',
  'copio-images',
  'copio-carousel',
];

const rootDir = path.resolve(__dirname, '../..');

const staticFiles = [
  '/',
  'index.html',
  'manifest.webmanifest',
  'favicon.ico',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'copio.svg',
];

const directoriesToScan = ['css', 'js', 'sdk', 'fonts'];

async function getFilesRecursively(dir) {
  const files = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await getFilesRecursively(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

async function findUsedIcons() {
  const iconNames = new Set();
  const jsFiles = await getFilesRecursively(path.join(rootDir, 'js'));
  const allFiles = [...jsFiles, path.join(rootDir, 'index.html')];
  const iconPattern = /<sl-icon(?:-button)?\s+[^>]*name=["']([^"']+)["']/g;
  const notifyIconPattern = /icon:\s*['"]([a-z0-9-]+)['"]/g;
  for (const file of allFiles) {
    try {
      const content = await readFile(file, 'utf-8');
      for (const match of content.matchAll(iconPattern)) {
        if (!match[0].includes('library="system"') && !match[0].includes("library='system'")) {
          if (/^[a-z0-9-]+$/.test(match[1])) {
            iconNames.add(match[1]);
          }
        }
      }
      for (const match of content.matchAll(notifyIconPattern)) {
        iconNames.add(match[1]);
      }
    } catch {}
  }
  return Array.from(iconNames).sort();
}

async function generateFilesToCache() {
  console.log('Generating files-to-cache.json...\n');
  const filesToCache = [...staticFiles];
  for (const dir of directoriesToScan) {
    console.log(`Scanning ${dir}/...`);
    const files = await getFilesRecursively(path.join(rootDir, dir));
    filesToCache.push(
      ...files
        .map((f) => relative(rootDir, f))
        .filter((p) => {
          const filename = p.split('/').pop() || '';
          if (filename.startsWith('.') || p.endsWith('.d.ts') || p.endsWith('.d.mts')) return false;
          // Heavy modules are lazy-loaded on demand (CPO-042, CPO-043); do not precache on initial SW install
          if (p.startsWith('js/lib/tesseract-core') || p.startsWith('assets/tessdata') || p === 'js/lib/pdfkit.js') {
            return false;
          }
          return true;
        })
        .sort(),
    );
  }
  console.log('Finding used icons...');
  const usedIcons = await findUsedIcons();
  console.log(`Found ${usedIcons.length} icons in use:`, usedIcons.join(', '));
  filesToCache.push(...usedIcons.map((icon) => `assets/icons/${icon}.svg`));
  await writeFile(path.join(rootDir, 'files-to-cache.json'), JSON.stringify(filesToCache, null, 2) + '\n');
  console.log(`\n✓ Generated files-to-cache.json with ${filesToCache.length} files`);
}

function generateCacheManifest() {
  return {
    name: 'generate-cache-manifest',
    async closeBundle() {
      await generateFilesToCache();
    },
  };
}

export default {
  input: 'src/index.js',
  output: {
    file: 'dist/shoelace.js',
    format: 'esm',
  },
  plugins: [
    resolve(),
    css({ output: 'shoelace.css' }),
    terser(),
    generateCacheManifest(),
    copy({
      targets: [
        {
          src: path.resolve(__dirname, 'dist/shoelace.css'),
          dest: path.resolve(__dirname, '../../css'),
        },
        {
          src: path.resolve(__dirname, 'dist/shoelace.js'),
          dest: path.resolve(__dirname, '../../js/lib'),
        },
        {
          src: path.resolve(
            __dirname,
            'node_modules/@shoelace-style/shoelace/dist/assets',
          ),
          dest: path.resolve(__dirname, '../../'),
        },
      ],
    }),
  ],
};
