---
title: Storage Adapters & Migrations
description: Pluggable StoragePort adapters and the CPO-013 schema migration contract for custom persistence backends.
section: Guides
order: 1
slug: storage-adapters
---

# Storage Adapters & Migration Contract

`@copio/sdk` persists documents, pages, and image blobs behind the `StoragePort` interface so host applications can store scans in OPFS, IndexedDB, memory, or a custom backend (e.g., encrypted SQLite, remote API, or Electron filesystem).

## Built-in Adapters

| Adapter | Persistence | Best For |
|---|---|---|
| `OpfsStorageAdapter` | Origin Private File System (IndexedDB fallback) | Production web apps needing fast binary blob storage |
| `IndexedDbStorageAdapter` | Browser IndexedDB | Broad browser compatibility without OPFS |
| `MemoryStorageAdapter` | Ephemeral in-memory `Map` | Unit tests, SSR, and temporary single-shot flows |
| `createDefaultAdapter()` | Auto-selects OPFS with IndexedDB fallback | Zero-config browser integrations |

```js
import { CopioEngine, IndexedDbStorageAdapter } from '@copio/sdk/core';

const engine = new CopioEngine({
  storage: new IndexedDbStorageAdapter({ dbName: 'my-app-scans' }),
});
await engine.ready;
```

## Assigning Storage on `<copio-scanner>`

Set the `.storage` property on `<copio-scanner>` before or after mounting:

```js
import { MemoryStorageAdapter } from '@copio/sdk';

const scanner = document.querySelector('copio-scanner');
scanner.storage = new MemoryStorageAdapter();
```

## Custom Adapter Contract (`StoragePort`)

Every `StoragePort` implementation must support document CRUD, blob storage, and the **CPO-013 schema version contract**:

- `init(): Promise<void>` — Initialize the underlying store.
- `listDocs(): Promise<Document[]>` — Return all stored documents.
- `getDoc(id: string): Promise<Document | null>` — Load a document by ID.
- `saveDoc(id: string, doc: Document): Promise<void>` — Persist or update a document.
- `deleteDoc(id: string): Promise<void>` — Delete a document and its associated blobs.
- `saveBlob(key: string, blob: Blob): Promise<void>` — Persist binary image data.
- `getBlob(key: string): Promise<Blob | null>` — Retrieve binary image data.
- `deleteBlob(key: string): Promise<void>` — Delete binary image data.
- `getSchemaVersion(): Promise<number | null>` — Return the persisted schema version, or `null` if unversioned.
- `setSchemaVersion(version: number): Promise<void>` — Persist the updated schema version.

## How `MigrationRunner` Works (CPO-013)

`CopioEngine` automatically runs `MigrationRunner.run({ storage, targetVersion })` during initialization (`engine.ready`):

1. **Fresh install** (`getSchemaVersion() === null` and `listDocs()` is empty): `MigrationRunner` writes `CURRENT_SCHEMA_VERSION` (`3`) via `setSchemaVersion()` without running historical migrations.
2. **Legacy unversioned data** (`getSchemaVersion() === null` and documents exist): `MigrationRunner` treats the store as version `0` and runs every migration up to `CURRENT_SCHEMA_VERSION`.
3. **Incremental upgrades**: Each migration step updates documents in place and calls `setSchemaVersion(migration.version)` after each step.

Listen for `copio:migration` (`COPIO_EVENTS.MIGRATION`) on `CopioEngine` or `<copio-scanner>` to observe migration progress:

```js
import { COPIO_EVENTS, CURRENT_SCHEMA_VERSION } from '@copio/sdk/core';

scanner.addEventListener(COPIO_EVENTS.MIGRATION, (event) => {
  console.log('Migration event:', event.detail, 'target:', CURRENT_SCHEMA_VERSION);
});
```
