import { playwrightLauncher } from '@web/test-runner-playwright';

export default {
  files: ['test/**/*.test.js'],
  nodeResolve: true,
  concurrency: 1,
  testFramework: {
    config: {
      timeout: '10000',
    },
  },
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
  testRunnerHtml: (testFramework) => `
    <!doctype html>
    <html>
      <head>
        <script src="/js/lib/cropper.js"></script>
        <script src="/js/lib/pdfkit.js"></script>
        <script src="/js/lib/jszip.min.js"></script>
        <script src="/js/lib/marked.min.js"></script>
      </head>
      <body>
        <script type="module" src="${testFramework}"></script>
      </body>
    </html>
  `,
  browsers: [
    playwrightLauncher({ product: 'chromium' }),
  ],
};
