---
title: Quickstart
description: Install @copio/sdk via npm or CDN, capture your first scan, and export a PDF in under 5 minutes.
section: Overview
order: 2
slug: getting-started
embeds: true
---

# Quickstart: Install to PDF in Under 5 Minutes

Get `<copio-scanner>` running in any web app, capture or import your first document pages, and export a PDF — all 100% locally in the browser.

> **Prerequisite:** Serve your app over `http://localhost` or `https://` (for example with `npx serve .` or Vite). Browsers restrict Camera, Web Workers, and OPFS storage on `file://` URLs.

## 1. Install `@copio/sdk`

### Option A: Zero-Build CDN (Fastest)

Drop a single module script into any HTML page. `cdn.js` automatically registers `<copio-scanner>` and `<copio-handoff>`, resolves lazy worker/WASM assets relative to the CDN URL, and exposes `window.Copio`:

```html
<script type="module" src="https://unpkg.com/@copio/sdk/dist/cdn.js"></script>
```

### Option B: npm + Bundler (Vite, Webpack, Rollup)

Install the package:

```bash
npm install @copio/sdk
```

Copy the SDK's lazy worker/WASM assets (`node_modules/@copio/sdk/dist/assets/`) into your app's public static directory (for example `public/assets/copio/`), then import the SDK and configure `setAssetBase()`:

```js
import { setAssetBase, COPIO_EVENTS } from '@copio/sdk';

setAssetBase('/assets/copio/');
```

## 2. Mount `<copio-scanner>`

Place `<copio-scanner>` inside a container with an explicit width and height (such as a modal, drawer, card, or `100dvh` viewport):

```html
<div style="width: 420px; height: 640px;">
  <copio-scanner
    id="scanner"
    mode="batch"
    aspect="a4"
    theme="dark">
  </copio-scanner>
</div>
```

> If you are using **Option B (npm)** without calling `setAssetBase()`, pass `asset-base="/assets/copio/"` as an attribute on `<copio-scanner>`.

## 3. Capture Your First Scan

Once mounted, you can capture pages using the built-in camera shutter or import image files from disk:

- **Interactive UI:** Click the shutter button to take a photo (or click the import icon to pick an image file), adjust the crop if needed, and click **Done** when finished.
- **Events:** Listen for `copio:page-added` as each page is captured and `copio:scan-complete` when the user finishes the session:

```js
const scanner = document.getElementById('scanner');

scanner.addEventListener(COPIO_EVENTS.PAGE_ADDED, (event) => {
  console.log('Page added:', event.detail.pageNumber, event.detail.page);
});

scanner.addEventListener(COPIO_EVENTS.SCAN_COMPLETE, (event) => {
  console.log('Scan complete:', event.detail.pageCount, 'pages', event.detail.pages);
});
```

## 4. Export to PDF

`<copio-scanner>` includes a built-in export menu, or you can trigger PDF generation programmatically from your host app with `scanner.exportPdf()`:

```js
const exportBtn = document.getElementById('export-pdf');

scanner.addEventListener(COPIO_EVENTS.EXPORT_PROGRESS, (event) => {
  console.log(`Exporting PDF: ${event.detail.percent}%`);
});

exportBtn.addEventListener('click', async () => {
  // Pass { searchable: true } to embed an invisible OCR text layer
  const pdfBlob = await scanner.exportPdf({ searchable: false });

  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'scanned-document.pdf';
  link.click();
  URL.revokeObjectURL(url);
});
```

## Complete Copy-Paste Example (`index.html`)

Save this as `index.html`, run `npx serve .`, and open `http://localhost:3000`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Copio Quickstart</title>
  <script type="module" src="https://unpkg.com/@copio/sdk/dist/cdn.js"></script>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; display: grid; place-items: center; min-height: 100vh; background: #0b0f17; color: #f8fafc; gap: 12px; }
    .stage { width: min(420px, 95vw); height: 620px; }
    button { padding: 10px 18px; border-radius: 8px; border: 0; background: #10b981; color: #052e16; font-weight: 600; cursor: pointer; }
  </style>
</head>
<body>
  <div class="stage">
    <copio-scanner id="scanner" mode="batch" aspect="a4" theme="dark"></copio-scanner>
  </div>
  <button id="download-pdf" type="button">Download PDF</button>

  <script type="module">
    const scanner = document.getElementById('scanner');

    scanner.addEventListener('copio:scan-complete', (e) => {
      console.log('Captured pages:', e.detail.pages);
    });

    document.getElementById('download-pdf').addEventListener('click', async () => {
      const pages = await scanner.getPages();
      if (!pages.length) {
        alert('Capture or import at least one page first.');
        return;
      }
      const blob = await scanner.exportPdf();
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), {
        href: url,
        download: 'copio-scan.pdf',
      });
      a.click();
      URL.revokeObjectURL(url);
    });
  </script>
</body>
</html>
```

## Live Preview

Try `<copio-scanner>` right here — import an image or use your camera, then switch aspect presets below:

<div class="docs-embed-card" data-embed-scanner>
  <div class="docs-embed-toolbar">
    <span class="docs-embed-title">Quickstart Live Embed</span>
    <div class="docs-embed-controls">
      <button type="button" class="docs-embed-btn" data-scanner-attr="aspect" data-scanner-val="receipt" aria-pressed="false">Receipt</button>
      <button type="button" class="docs-embed-btn" data-scanner-attr="aspect" data-scanner-val="a4" aria-pressed="true">A4</button>
      <button type="button" class="docs-embed-btn" data-scanner-attr="aspect" data-scanner-val="id-card" aria-pressed="false">ID Card</button>
    </div>
  </div>
  <div class="docs-embed-stage">
    <copio-scanner mode="batch" aspect="a4" theme="dark" asset-base="/dist/"></copio-scanner>
  </div>
</div>

## Next Steps

- **[API Reference](/docs/api/):** Full properties, attributes, events, methods, CSS custom properties, and parts.
- **[Framework Integration](/docs/framework-integration/):** Copy-paste recipes for React, Vue 3, Angular, Svelte, and TypeScript.
- **[Theming](/docs/theming/):** Customize colors, typography, and spacing with CSS custom properties.
- **[Storage Adapters](/docs/storage-adapters/):** Persist scans in OPFS, IndexedDB, memory, or your own backend.
- **[Offline & Service Workers](/docs/offline-service-worker/):** Cache `/assets/copio/` and request persistent browser storage.
- **[Phone-to-Desktop Handoff](/docs/handoff/):** Pair a mobile phone to scan directly into a desktop browser via E2EE WebRTC.
