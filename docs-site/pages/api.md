---
title: API Reference
description: Complete @copio/sdk v1.0 public and advanced API reference generated from the Custom Elements Manifest.
section: Reference
order: 1
slug: api
---

# API Reference

The `@copio/sdk` v1.0 API is organized into focused entry points and generated directly from the package **Custom Elements Manifest** (`dist/custom-elements.json`) and [ADR 0004](https://github.com/edwilliams/copio). Only **Public** and **Advanced** exports are documented here; internal utilities and app-only dialogs are excluded.

## Package Entry Points

| Import | Purpose |
|---|---|
| `@copio/sdk` | Batteries-included root entry (UI components + `CopioEngine` + default adapters) |
| `@copio/sdk/scanner` | Self-contained `<copio-scanner>` element, `COPIO_EVENTS`, and style helpers |
| `@copio/sdk/handoff` | `<copio-handoff>` element (`@experimental`), `HandoffSession`, and crypto/token helpers |
| `@copio/sdk/core` | Zero-DOM headless `CopioEngine`, domain models, `StoragePort`, and `MigrationRunner` |
| `@copio/sdk/sync` | `SyncManager` and `getIceServers` for P2P WebRTC document sync |
| `@copio/sdk/adapters/*` | Individual port and adapter modules for tree-shaken custom integrations |

## Public & Advanced Export Surface

<!-- CEM:PUBLIC_EXPORTS -->

## `<copio-scanner>` Element

Embeddable two-stage (`viewfinder` ↔ `workbench`) document scanner Web Component.

<!-- CEM:copio-scanner -->

## `<copio-handoff>` Element

Desktop QR-to-WebRTC end-to-end encrypted phone handoff widget.

<!-- CEM:copio-handoff -->

## `CopioEngine` (Headless Core)

Import from `@copio/sdk` or `@copio/sdk/core` for headless document management, non-destructive edits, OCR, and export without DOM dependencies.

<!-- CEM:copio-engine -->

## Headless Helpers & Domain Models

### Asset Configuration

- `setAssetBase(baseUrl: string): void` — Sets the base URL used to lazy-load OCR WASM, edge-detection workers, and PDF/QR vendor assets.
- `getAssetBase(): string` — Returns the currently configured asset base URL.

### Headless OCR & Export Functions

- `recognizeImageText(input, options?)` — Runs client-side OCR on a single `Blob`, `File`, or data URL and returns `{ text, confidence, words }`.
- `recognizeDocumentPages(doc, options?)` — Runs OCR across all pages of a `Document` and returns per-page and combined text results.
- `exportDocumentAsPdf(doc, options?)` — Compiles a `Document` into a standard or searchable PDF `Blob` (with optional OCR text layer).
- `exportDocumentAsImages(doc, options?)` — Exports a `Document` as a ZIP archive or individual PNG/JPEG `Blob`s.

### Domain Models & Constants

- `Document` — Represents a scanned document containing ordered `Page` entities, `id`, `name`, `createdAt`, and `updatedAt`.
- `Page` — Represents a single captured page with original blob reference, non-destructive edit stack (`crop`, `rotate`, `bw`, `quad`), and optional OCR text.
- `ScanSession` — Tracks an active multi-page capture session before committing to a `Document`.
- `COPIO_EVENTS` — Frozen map of all `copio:*` `CustomEvent` names.
- `VERSION` — Current `@copio/sdk` semantic version string.
- `CURRENT_SCHEMA_VERSION` — Current stored document schema version (`3`).

## Guides

- [Storage Adapters & Migration Contract](/docs/storage-adapters/)
- [Theming & CSS Parts](/docs/theming/)
- [Licensing & Privacy](/docs/licensing/)
- [Framework Integration](/docs/framework-integration/)
- [Offline & Service Workers](/docs/offline-service-worker/)
