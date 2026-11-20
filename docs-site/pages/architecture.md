---
title: Architecture & Adapters
description: Headless CopioEngine and Hexagonal Ports & Adapters for storage, OCR, PDF export, image processing, edge detection, and P2P sync.
section: Architecture
order: 1
slug: architecture
---

# Architecture & Adapters

Copio separates its **headless domain core** (`CopioEngine`) from UI components (`<copio-scanner>`, `<copio-handoff>`) and platform capabilities using **Hexagonal Architecture (Ports & Adapters)**.

## Zero-DOM Headless Core

Import `@copio/sdk/core` in Node.js, Web Workers, or custom UI frameworks without pulling in Lit or DOM dependencies:

```js
import { CopioEngine, MemoryStorageAdapter } from '@copio/sdk/core';

const engine = new CopioEngine({
  storage: new MemoryStorageAdapter(),
});
```

## Ports & Built-in Adapters

| Port | Built-in Adapters | Purpose |
|---|---|---|
| `StoragePort` | `OpfsStorageAdapter`, `IndexedDbStorageAdapter`, `MemoryStorageAdapter` | Non-destructive document & blob persistence |
| `OcrPort` | `TesseractWasmAdapter`, `NullOcrAdapter` | Client-side multi-language OCR |
| `PdfPort` | `PdfKitAdapter`, `NullPdfAdapter` | Standard & searchable PDF export |
| `ImageProcessorPort` | `Canvas2DAdapter`, `NullImageProcessorAdapter` | Crop, rotate, threshold, perspective warp |
| `EdgeDetectorPort` | `ScanicWasmEdgeAdapter`, `NullEdgeDetectorAdapter` | Neural/WASM document quad detection |
| `SyncPort` | `PeerJsAdapter`, `NullSyncAdapter` | P2P WebRTC document sync |

## Schema Migrations

`MigrationRunner` and `CURRENT_SCHEMA_VERSION` ensure stored document metadata upgrades safely across SDK versions. Custom `StoragePort` implementations integrate directly with `MigrationRunner`.
