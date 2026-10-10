import { playwrightLauncher } from '@web/test-runner-playwright';

export default {
  files: ['test/**/*.test.js'],
  nodeResolve: true,
  plugins: [
    {
      name: 'resolve-node-builtins',
      resolveImport({ source }) {
        if (['fs', 'path', 'http', 'https', 'url', 'stream', 'zlib', 'canvas', 'path2d'].includes(source)) {
          return '/test/mocks/empty-module.js';
        }
      },
    },
  ],
  browsers: [
    playwrightLauncher({ product: 'chromium' }),
  ],
};
