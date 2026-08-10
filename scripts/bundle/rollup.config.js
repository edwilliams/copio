import path from 'path';
import { readFileSync, writeFileSync } from 'fs';
import { readdir, writeFile, readFile } from 'fs/promises';
import { relative } from 'path';
import resolve from 'rollup-plugin-node-resolve';
import copy from 'rollup-plugin-copy';
import css from 'rollup-plugin-css-only';
import { terser } from 'rollup-plugin-terser';

const COPIO_COMPONENTS = [
  'copio-app',
  'copio-loader',
  'copio-header',
  'copio-row',
  'copio-images',
  'copio-carousel',
];

const rootDir = path.resolve(__dirname, '../..');

const staticFiles = [
  'index.html',
  './',
  'manifest.webmanifest',
  'favicon.ico',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'copio.svg',
];

const directoriesToScan = ['css', 'js', 'fonts'];

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
  for (const file of allFiles) {
    try {
      const content = await readFile(file, 'utf-8');
      for (const match of content.matchAll(iconPattern)) {
        if (!match[0].includes('library="system"') && !match[0].includes("library='system'")) {
          iconNames.add(match[1]);
        }
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
        .filter((p) => !p.split('/').pop().startsWith('.'))
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

function generateRegisterComponents() {
  return {
    name: 'generate-register-components',
    async closeBundle() {
      const src = readFileSync(path.resolve(__dirname, 'src/index.js'), 'utf-8');
      const slComponents = [...src.matchAll(/\/components\/([^/]+)\/[^'"]+\.js/g)]
        .map((m) => `sl-${m[1]}`);

      const slLines = slComponents.map((c) => `  customElements.whenDefined('${c}'),`).join('\n');
      const copioLines = COPIO_COMPONENTS.map((c) => `  customElements.whenDefined('${c}'),`).join('\n');

      const content = `import './copio-app.js';
import './copio-loader.js';
import './copio-header.js';
import './copio-row.js';
import './copio-images.js';
import './copio-carousel.js';

// =============================================
// Show UI when custom components are ready
// note: might not be great loading this before app.js
// =============================================

// trick borrow from shoelace; prevents flash of unstyled content
await Promise.allSettled([
  // shoelace
${slLines}
  // copio
${copioLines}
]);

document.body.classList.add('ready');
`;

      writeFileSync(path.resolve(__dirname, '../../js/register-components.js'), content);
      console.log('✓ Generated register-components.js');

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
    generateRegisterComponents(),
    copy({
      copyOnce: true,
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
