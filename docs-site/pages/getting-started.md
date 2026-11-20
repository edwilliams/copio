---
title: Quickstart
description: Install @copio/sdk via npm or CDN and embed your first <copio-scanner> component.
section: Overview
order: 2
slug: getting-started
embeds: true
---

# Quickstart

Embed `<copio-scanner>` in any web application with a few lines of HTML and JavaScript.

## 1. Install via npm

```bash
npm install @copio/sdk
```

Import the batteries-included entry point and point `setAssetBase` to where your bundler serves the SDK's lazy worker/WASM assets:

```js
import { setAssetBase, COPIO_EVENTS } from '@copio/sdk';

setAssetBase('/assets/copio/');
```

Or use the standalone CDN script tag for zero-build prototypes:

```html
<script type="module" src="https://unpkg.com/@copio/sdk/dist/cdn.js"></script>
```

## 2. Mount `<copio-scanner>`

Place `<copio-scanner>` inside any sized container (modal, drawer, card, or full viewport):

```html
<div style="width: 420px; height: 640px;">
  <copio-scanner
    mode="batch"
    aspect="a4"
    theme="dark"
    asset-base="/assets/copio/">
  </copio-scanner>
</div>
```

## 3. Listen to `copio:*` Events

```js
const scanner = document.querySelector('copio-scanner');

scanner.addEventListener(COPIO_EVENTS.SCAN_COMPLETE, (event) => {
  console.log('Scan complete:', event.detail);
});
```

## Live Preview

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
