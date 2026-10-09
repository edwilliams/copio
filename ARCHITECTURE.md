# Copio — Architecture Guide

> For developers and AI assistants getting up to speed. Complements `README.md` (user-facing) with the *how* and *why* of the codebase.

---

## Mental Model

Copio is a **single-page app with no build step**. Every file you see is what the browser runs. There is no TypeScript compilation, no bundler, no JSX transform. The `js/lib/` folder contains pre-built third-party bundles; everything else is vanilla ES modules authored directly.

The app is offline-first: the Service Worker caches every asset at install time. Any new file added to the project **must** be added to `files-to-cache.json` and the `CACHE_NAME` version bumped in `sw.js`.

---

## Folder Structure

```
js/
  core/               Singletons — instantiated once, imported anywhere
    store.js          TinyBase store + IndexedDB persister (the single source of truth)
    router.js         Hash-based SPA router singleton
    register-components.js  Entry point: imports all components, waits for CE definitions

  components/         Global shell components (not tied to a specific route)
    copio-app.js      Root orchestrator — owns routing, store bridge, event handling
    copio-header.js   Top nav bar
    copio-loader.js   Full-screen loading spinner

  routes/             One folder per route; components live where they're used
    home/
      copio-row.js          Document list row (/ home view)
    doc/
      copio-images.js       Page editor / image ingestion (/doc/:id/edit)
      copio-carousel.js     Full-screen viewer (/doc/:id)
    ocr/
      copio-doc-ocr-dialog.js  OCR dialog (/doc/:id + OCR action)
    sync/
      copio-sync-dialog.js  P2P sync dialog (/sync, /sync/:peer)
    add-edit/
      copio-add-edit-dialog.js  Add / edit document dialog (/add, /doc/:id/edit)

  services/           Headless business logic (no rendering)
    sync-service.js   PeerJS WebRTC session management
    ocr-service.js    Tesseract.js worker lifecycle + batch OCR
    export-utils.js   PDF (PDFKit), ZIP (JSZip), Markdown export

  utils/              Pure functions, no side-effects
    utils.js          randomId, fileToBase64, thresholdSrc (Sauvola binarization),
                      rotateSrc, getCroppedSrc, extractExif
    pdf-utils.js      Renders PDF pages to data URLs via PDF.js

  lib/                Third-party pre-built bundles — do not edit
```

---

## Core Patterns

### 1. No Shadow DOM

Every Lit component uses:
```js
createRenderRoot() { return this; }
```
This opts into **Light DOM** so Shoelace's global CSS custom properties and `sl-*` components work without crossing shadow boundaries. This is intentional and should be preserved on any new component.

### 2. Pluggable Storage (doc-repository)

Data is accessed entirely through `js/services/doc-repository.js`, which acts as a headless wrapper around a pluggable Storage Adapter.
Components never access IndexedDB or TinyBase directly.

The default adapter is `TinyBaseAdapter` (which wraps TinyBase `store.js`), but `MemoryAdapter` is also available, and `OpfsAdapter` is coming.

**Adapter Contract:**
```js
{
  init() → Promise<{ kind, persistent: boolean }>
  listDocs() → Record<string, Doc>
  getDoc(id) → Doc
  saveDoc(doc)
  deleteDoc(id)
  
  // Blob storage (implemented in CPO-012)
  savePage(docId, pageId, blob) → Promise<void>
  getPage(docId, pageId) → Promise<Blob>
  deletePage(docId, pageId) → Promise<void>
  
  subscribe(callback) → unsubscribeFn
}
```
A custom adapter stub can be implemented by satisfying this interface.

### 3. Data model

A `Doc` object looks like this:
```js
{
  id: "abc1234",
  name: "My Document",
  pages: [
    // Image page (v1: src is base64; v2: src will be Blob URL)
    { id, src, exif, type: 'image'|'pdf', name },
    // Markdown page
    { id, type: 'markdown', name, content }
  ]
}
```

Behind the scenes in `TinyBaseAdapter`, `pages` is currently stringified to JSON in IndexedDB to keep the schema flat. `doc-repository.js` transparently handles the conversion.

### 4. Router

`js/core/router.js` exports a `SimpleRouter` singleton (`router`). It's hash-based (`#/doc/abc123`). Routes are named:

| Name | Path |
|---|---|
| `home` | `/` |
| `add` | `/add` |
| `doc-view` | `/doc/:id` |
| `doc-edit` | `/doc/:id/edit` |
| `sync-host` | `/sync` |
| `sync-join` | `/sync/:peer` |

Navigate programmatically: `router.navigate('/doc/abc123')`.
Subscribe to changes: `router.onRouteChange(({ name, params }) => ...)` — returns an unsubscribe function.

`copio-app.js` is the only subscriber. Route changes are handled in `#handleRouteChange()` which delegates to other components via their imperative APIs (e.g. `dialog.open()`, `dialog.openEdit()`).

### 5. Component communication

Components communicate **upward via custom events**, **downward via properties/methods**:

- `copio-row` fires `copio-row:edit`, `copio-row:view`, `copio-row:delete`, etc. → `copio-app` handles them
- `copio-add-edit-dialog` fires `copio-add-edit-dialog:save` with `{ id, name, pages }` → `copio-app` writes to store
- `copio-sync-dialog` fires `copio-sync-dialog:close` → `copio-app` calls `syncManager.close()`
- `copio-doc-ocr-dialog` fires `copio-ocr:save-note` → `copio-app` appends a markdown page to the doc

All custom events use `{ bubbles: true }` and follow the `component-name:action` naming convention.

### 6. TinyBase → Lit reactivity bridge

TinyBase is not Lit-aware. The bridge in `copio-app.js` constructor:
```js
this.store.addTableListener('docs', () => {
  this.docsData = this.store.getTable('docs'); // triggers Lit re-render
  if (router.getHashPath().startsWith('/doc/')) {
    router.handleRoute(); // re-run route if viewing a doc (pages may have changed)
  }
});
```

### 7. Offline / Service Worker

`sw.js` uses a **cache-first** strategy. On install it fetches `files-to-cache.json` and caches every listed asset atomically via `cache.addAll()` (all-or-nothing). If any file 404s, the install fails and nothing is cached.

**Rules when changing files:**
- Every new JS/CSS/asset file → add to `files-to-cache.json`
- Every deploy → bump `CACHE_NAME` version in `sw.js` (e.g. `copio-cache-v14`)
- `"/"` and `"index.html"` are both listed (cover both root URL forms)

---

## Entry Point Flow

```
index.html
  └── <script type="module" src="js/core/register-components.js">
        ├── imports all copio-*.js components (self-register via customElements.define)
        ├── awaits Promise.allSettled([customElements.whenDefined(...)]) for all sl-* and copio-*
        └── document.body.classList.add('ready')  ← triggers CSS fade-in, hides loader
```

`copio-app` is mounted as `<copio-app>` in `index.html`. Its `firstUpdated()` lifecycle hook kicks off data loading and routing.

---

## Key Third-Party Libraries

| Library | How it's used | Loaded as |
|---|---|---|
| **Lit** (`lit-core.min.js`) | Base class for all components | ES module |
| **TinyBase** | Reactive store + IndexedDB persistence | ES module |
| **Shoelace** | UI components (`sl-dialog`, `sl-button`, etc.) | ES module (auto-registers) |
| **Tesseract.js** | OCR via WASM Web Worker | Global (`window.Tesseract`) |
| **PDFKit** | Client-side PDF generation | Global (`window.PDFDocument`) |
| **PDF.js** | Renders uploaded PDFs to images | ES module |
| **PeerJS** | WebRTC for P2P sync | Global (`window.Peer`) |
| **Cropper.js** | Interactive image crop UI | Global (`window.Cropper`) |
| **JSZip** | ZIP bundle export | Global (`window.JSZip`) |
| **Sortable.js** | Drag-to-reorder pages | ES module |
| **qrcode** | QR code generation for sync URL | Global (`window.qrcode`) |

Globals are loaded as classic `<script>` tags in `index.html` before the module graph. Modules are imported inside the ES module graph.

---

## Adding a New Route

1. Create `js/routes/your-route/copio-your-component.js` — a Lit component with `createRenderRoot() { return this; }`
2. Add the route to `ROUTES` in `js/core/router.js`
3. Handle the new route `name` in `copio-app.js` `#handleRouteChange()`
4. Import the component in `js/core/register-components.js` and add to the `whenDefined` list
5. Add the file path to `files-to-cache.json`
6. Bump `CACHE_NAME` in `sw.js`

## Adding a New Utility / Service

- **Pure function** (no DOM, no side-effects) → `js/utils/utils.js` or a new file in `js/utils/`
- **Stateful service** (manages a worker, connection, etc.) → new file in `js/services/`
- Services can import from utils; utils must not import from services

---

## Gotchas

- **Shoelace dialogs are async** — `await dialog.show()` before trying to focus inputs
- **OCR workers are long-lived** — `ocr-service.js` caches the active Tesseract worker; switching language terminates and recreates it
- **P2P sync requires internet** — PeerJS needs its signalling server; `sync-service.js` checks `navigator.onLine` before attempting
- **Tesseract and PDF.js worker paths** in `ocr-service.js` and `pdf-utils.js` are hardcoded as absolute paths from the site root — they don't need updating if those service files move
