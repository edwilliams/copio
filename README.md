# `@copio/sdk`

**Embeddable document scanner Web Component (`<copio-scanner>`) and headless JavaScript engine (`CopioEngine`) for web applications.**

Capture, crop, binarize, OCR, and compile multi-page Searchable PDFs 100% client-side in the browser — zero cloud uploads, zero per-scan API fees, and zero framework lock-in.

[![License: AGPL-3.0 / Commercial](https://img.shields.io/badge/License-AGPL--3.0%20%2F%20Commercial-0284c7)](LICENSE)
[![Scanner Bundle](https://img.shields.io/badge/scanner%20bundle-54%20KB%20gzip-16a34a)](#entry-points--bundle-sizes)
[![Zero Cloud Uploads](https://img.shields.io/badge/privacy-100%25%20on--device-10b981)](#use-cases)

👉 **[Live Interactive SDK Sandbox & Event Inspector →](https://copio.netlify.app)**

---

## Built For

- **Expense & AP Automation SaaS** — Single-shot receipt capture (`aspect="receipt"`) and multi-page vendor invoice scanning (`mode="batch" aspect="a4"`).
- **Fintech Onboarding & KYC** — Guided front-and-back ID / card capture (`aspect="card" max-pages="2"`).
- **Healthcare, Legal & Insurance Portals** — 100% on-device Sauvola B&W document cleanup, Tesseract WASM OCR, and Searchable PDF generation before uploading to your own storage (HIPAA / GDPR friendly).
- **Local-First & Offline PWAs** — Pluggable persistence across Origin Private File System (OPFS), IndexedDB, or ephemeral in-memory sessions.

---

## Install

```bash
npm install @copio/sdk
```

Works in **Vanilla JS, React, Vue, Svelte, and Angular** via native Shadow DOM custom elements (`<copio-scanner>`) with full TypeScript declarations (`.d.ts`) and Custom Elements Manifest (`custom-elements.json`).

---

## 30-Second Quickstart

Import `@copio/sdk/scanner` (self-contained, ~54 KB gzipped) and drop `<copio-scanner>` into any modal, drawer, or page container:

```html
<copio-scanner
  id="scanner"
  mode="batch"
  aspect="a4"
  theme="dark"
></copio-scanner>

<script type="module">
  import { COPIO_EVENTS } from '@copio/sdk/scanner';

  const scanner = document.getElementById('scanner');

  scanner.addEventListener(COPIO_EVENTS.SCAN_COMPLETE, (e) => {
    const { pages, pageCount } = e.detail;
    console.log(`Captured ${pageCount} page(s):`, pages);
  });
</script>
```

---

## Common Integration Recipes

### 1. Searchable PDF Export & Client-Side OCR

Heavy WASM/PDF engines (`pdfkit` and `tesseract.js`) are **excluded** from `@copio/sdk/scanner` by default so your initial bundle stays small. Import `@copio/sdk` (or register `PdfKitAdapter` and `TesseractWasmAdapter`) when you need PDF compilation or OCR:

```js
import { COPIO_EVENTS } from '@copio/sdk'; // Registers default PDF + OCR adapters

const scanner = document.querySelector('copio-scanner');

// 1. Export a multi-page Searchable PDF (embeds an invisible, selectable OCR text layer)
const pdfBlob = await scanner.exportPdf({
  docName: 'vendor-invoice-1042',
  searchable: true,      // Set false for standard image-only PDF
  download: true,        // Trigger browser download (or false to upload pdfBlob to S3)
  onProgress: (done, total, msg) => console.log(msg || `${done}/${total}`),
});

// 2. Or run standalone OCR text & bounding-box extraction
const { text, pagesResults, averageConfidence } = await scanner.ocr();
console.log(`Recognized (${Math.round(averageConfidence)}% confidence):`, text);
```

### 2. Scenario Presets (Receipts, ID Cards, Multi-Page Invoices)

```html
<!-- 1. Expense Receipt (Single Page, Tall Aspect Guide) -->
<copio-scanner mode="single" aspect="receipt" max-pages="1"></copio-scanner>

<!-- 2. KYC ID Card (Front & Back Guided Capture) -->
<copio-scanner mode="single" aspect="card" max-pages="2"></copio-scanner>

<!-- 3. Multi-Page Document Batch -->
<copio-scanner mode="batch" aspect="a4"></copio-scanner>
```

### 3. Headless Engine (`@copio/sdk/core`)

Building your own UI in Tailwind/React or processing files in a background pipeline? Use `CopioEngine` with zero DOM or UI dependencies:

```js
import { CopioEngine, MemoryStorageAdapter } from '@copio/sdk/core';
import { PdfKitAdapter, TesseractWasmAdapter } from '@copio/sdk';

const engine = new CopioEngine({
  storage: new MemoryStorageAdapter(),
  services: {
    pdf: new PdfKitAdapter(),
    ocr: new TesseractWasmAdapter(),
  },
});

// Ingest File/Blob objects (auto-extracts EXIF orientation)
const pages = await engine.addFiles(fileInput.files);

// Apply non-destructive edits (original image is always preserved)
await engine.applyEdit(null, pages[0].id, {
  rotation: 90,
  filter: 'bw', // Adaptive Sauvola B&W document thresholding
  crop: { x: 20, y: 20, width: 600, height: 800 },
});

// Compile Searchable PDF Blob for upload
const pdfBlob = await engine.exportPdf(null, { searchable: true });
```

### 4. Styling & Host Theme Tokens

`<copio-scanner>` uses encapsulated Shadow DOM so host CSS resets (e.g. Tailwind preflight) never break the scanner layout. Customize colors, radii, and typography with `--copio-*` CSS custom properties:

```css
copio-scanner {
  width: 100%;
  height: 640px;
  --copio-bg: #0b0f17;
  --copio-surface: #131b26;
  --copio-primary: #38bdf8;
  --copio-success: #22c55e;
  --copio-text: #f8fafc;
  --copio-border-radius: 12px;
}
```

---

## Entry Points & Bundle Sizes

| Import Path | Gzip Size | What It Includes |
|---|---:|---|
| `@copio/sdk/scanner` | **~54 KB** | Self-contained `<copio-scanner>` Web Component (camera, framing guides, crop, rotate, B&W filter, undo/redo). Zero external chunks. |
| `@copio/sdk/core` | **~17 KB** | Headless `CopioEngine`, domain models (`Document`, `Page`, `EditStack`), and `StoragePort` adapters (`Memory`, `IndexedDB`). Zero DOM. |
| `@copio/sdk` | **~29 KB** | Full SDK entry point — exports `<copio-scanner>`, `CopioEngine`, and pre-registers lazy-loaded `PdfKitAdapter`, `TesseractWasmAdapter`, and `SyncManager`. |
| `@copio/sdk/sync` | **~5 KB** | WebRTC peer-to-peer sync (`SyncManager`, `CopioSyncDialog`). |

---

## `<copio-scanner>` API Reference

### Attributes / Properties

| Attribute | Property | Default | Description |
|---|---|---|---|
| `mode` | `scanner.mode` | `'single'` | `'single'` (auto-advances to workbench) or `'batch'` (continuous multi-page capture). |
| `aspect` | `scanner.aspect` | `'a4'` | Framing guide aspect ratio: `'a4'`, `'receipt'`, `'card'`, or `'free'`. |
| `max-pages` | `scanner.maxPages` | `0` | Maximum allowed pages (`0` = unlimited, `1` = single receipt, `2` = front/back ID). |
| `theme` | `scanner.theme` | `'dark'` | Built-in theme preset: `'dark'`, `'light'`, or `'brand'`. |
| `stage` | `scanner.stage` | `'viewfinder'` | Active view stage: `'viewfinder'` (camera/import) or `'workbench'` (crop/filter/reorder). |
| `features` | `scanner.features` | `'crop rotate filter ocr export sync'` | Space- or comma-separated list of enabled capabilities. |
| `ocr-languages` | `scanner.ocrLanguages` | `'eng'` | Language codes passed to Tesseract WASM (`'eng'`, `'fra'`, `'deu'`, `'spa'`, etc.). |
| `asset-base` | `scanner.assetBase` | `''` | Custom base URL for self-hosting lazy worker/WASM assets. |

### Methods

| Method | Returns | Description |
|---|---|---|
| `addFiles(files)` | `Promise<Page[]>` | Ingest `FileList`, `File[]`, or `Blob[]` (images or existing PDFs) into the active scan session. |
| `getPages()` | `Promise<Page[]>` | Return current pages with `src` (edited), `originalSrc` (untouched), `edits`, and `ocrText`. |
| `clear()` | `Promise<void>` | Clear all pages in the current session and reset the scanner. |
| `exportPdf(opts?)` | `Promise<Blob>` | Compile pages into a PDF `Blob`. Pass `{ searchable: true, download: true, docName, onProgress }`. |
| `exportZip(opts?)` | `Promise<Blob>` | Package pages into a ZIP archive `Blob`. |
| `ocr(pageId?, opts?)` | `Promise<OcrResult>` | Run client-side OCR on all pages (or a single `pageId`) and attach `ocrText` / `ocrWords`. |

### Custom Events (`COPIO_EVENTS`)

All events bubble and cross the Shadow DOM boundary (`composed: true`) with typed payload details on `event.detail`:

| Constant | Event Name | Payload (`event.detail`) |
|---|---|---|
| `COPIO_EVENTS.SCAN_COMPLETE` | `copio:scan-complete` | `{ pages, pageCount, docId, mode, aspect }` |
| `COPIO_EVENTS.PAGE_ADDED` | `copio:page-added` | `{ page, pageNumber, docId, source }` |
| `COPIO_EVENTS.PAGE_REMOVED` | `copio:page-removed` | `{ pageId, docId }` |
| `COPIO_EVENTS.PAGES_CHANGED` | `copio:pages-changed` | `{ pages, docId }` |
| `COPIO_EVENTS.OCR_COMPLETE` | `copio:ocr-complete` | `{ text, pages, averageConfidence, docId, pageId }` |
| `COPIO_EVENTS.EXPORT_COMPLETE` | `copio:export-complete` | `{ type, format, blob, searchable, docId }` |
| `COPIO_EVENTS.ERROR` | `copio:error` | `{ code, message, error }` |

---

## Ecosystem

`@copio/sdk` powers two open-source reference applications:
- **[`copio-documents`](https://github.com/edwilliams/copio-documents)** — Standalone offline-first document & Markdown notes workspace PWA with full-database WebRTC sync.
- **[`copio-cards`](https://github.com/edwilliams/copio-cards)** — Offline loyalty & ID card wallet PWA built on `<copio-scanner aspect="card">`.

---

## License

`@copio/sdk` is dual-licensed under **AGPL-3.0** and a **Commercial License**:

- **Community / Open Source ([AGPL-3.0](LICENSE)):** Free for open-source projects, internal evaluation, and applications licensed under AGPL-3.0.
- **Commercial License ([LICENSE-COMMERCIAL.md](LICENSE-COMMERCIAL.md)):** One-time perpetual license for proprietary web applications and closed-source SaaS products (removes AGPL copyleft obligations and the Community watermark). Contact `license@copio.dev`.
- **Third-Party Notices:** Permissive licenses for vendored libraries are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
