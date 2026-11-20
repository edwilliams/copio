---
title: API Reference
description: Overview of the @copio/sdk v1.0 public export surface, entry points, and Custom Elements Manifest.
section: Reference
order: 1
slug: api
---

# API Reference

The `@copio/sdk` public API is organized into focused entry points and documented via the generated Custom Elements Manifest (`dist/custom-elements.json`).

## Package Entry Points

| Import | Description |
|---|---|
| `@copio/sdk` | Root batteries-included entry (UI + `CopioEngine` + default adapters) |
| `@copio/sdk/scanner` | `<copio-scanner>` element, `COPIO_EVENTS`, and style helpers |
| `@copio/sdk/handoff` | `<copio-handoff>` element, `HandoffSession`, and token helpers |
| `@copio/sdk/core` | Headless `CopioEngine`, domain models, and port interfaces |
| `@copio/sdk/sync` | `SyncManager` and ICE server helpers |
| `@copio/sdk/adapters/*` | Individual adapters for tree-shaken custom setups |

## Core Public Symbols

- **Components:** `CopioScanner` (`<copio-scanner>`), `CopioHandoff` (`<copio-handoff>`, `@experimental`)
- **Engine & Models:** `CopioEngine`, `Document`, `Page`, `ScanSession`
- **Events & Version:** `COPIO_EVENTS`, `VERSION`, `setAssetBase`, `getAssetBase`
- **Headless Helpers:** `recognizeImageText`, `recognizeDocumentPages`, `exportDocumentAsPdf`, `exportDocumentAsImages`
- **Storage:** `StoragePort`, `createDefaultAdapter`, `OpfsStorageAdapter`, `IndexedDbStorageAdapter`, `MemoryStorageAdapter`
