import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sdkDistDir = path.resolve(__dirname, 'node_modules/@copio/sdk/dist');

const MIME_TYPES: Record<string, string> = {
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.json': 'application/json; charset=utf-8',
  '.gz': 'application/gzip',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.onnx': 'application/octet-stream',
};

function copioAssetsPlugin(): Plugin {
  return {
    name: 'copio-sdk-assets',
    configureServer(server) {
      server.middlewares.use('/copio-sdk', (req, res, next) => {
        const cleanUrl = (req.url || '/').split('?')[0];
        const filePath = path.join(sdkDistDir, cleanUrl);
        if (!filePath.startsWith(sdkDistDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          return next();
        }
        const ext = path.extname(filePath);
        res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
        fs.createReadStream(filePath).pipe(res);
      });
    },
    closeBundle() {
      const outDir = path.resolve(__dirname, 'dist/copio-sdk');
      for (const sub of ['assets', 'js']) {
        const src = path.join(sdkDistDir, sub);
        if (fs.existsSync(src)) {
          fs.cpSync(src, path.join(outDir, sub), { recursive: true });
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag.startsWith('copio-'),
        },
      },
    }),
    copioAssetsPlugin(),
  ],
  build: {
    target: 'es2022',
  },
});
