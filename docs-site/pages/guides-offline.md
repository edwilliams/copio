---
title: Offline & Service Workers
description: Host Service Worker caching, asset-base configuration, and persistent storage guidelines for offline Copio deployments.
section: Guides
order: 5
slug: offline-service-worker
---

# Offline & Service Worker Considerations for Hosts

`@copio/sdk` is designed for offline-first workflows, but it **intentionally does not register or bundle its own Service Worker**. Registering a library-owned Service Worker would conflict with your application's caching strategy, scope, and update lifecycle.

## 1. Host Lazy Assets via `setAssetBase()`

Heavy modules (Tesseract WASM OCR, Scanic edge detection worker/model, PDFKit, JSZip, QRCode) are lazy-loaded on demand from `dist/assets/`. Copy `node_modules/@copio/sdk/dist/assets` to a public static directory in your app and point the SDK at it:

```js
import { setAssetBase } from '@copio/sdk';

setAssetBase('/assets/copio/');
```

Or via HTML attribute:

```html
<copio-scanner asset-base="/assets/copio/"></copio-scanner>
```

## 2. Pre-cache or Runtime-Cache `/assets/copio/`

To guarantee OCR, PDF export, and edge detection work completely offline after first load, include your `assetBase` directory in your host Service Worker's cache rules (for example with Workbox):

```js
import { registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';

registerRoute(
  ({ url }) => url.pathname.startsWith('/assets/copio/'),
  new CacheFirst({ cacheName: 'copio-sdk-assets-v1' }),
);
```

## 3. Request Persistent Browser Storage

Browsers can evict IndexedDB and OPFS data under storage pressure. For offline-critical apps using `OpfsStorageAdapter` or `IndexedDbStorageAdapter`, request durable storage early in your app lifecycle:

```js
if (navigator.storage?.persist) {
  const granted = await navigator.storage.persist();
  console.log('Persistent storage granted:', granted);
}
```

## 4. WebRTC Handoff in Offline / LAN Environments

`<copio-handoff>` requires a signaling channel during initial pairing. Once a WebRTC DataChannel is established on the same local network, page transfers happen peer-to-peer without uploading document bytes to any server.
