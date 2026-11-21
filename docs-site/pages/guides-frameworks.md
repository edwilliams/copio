---
title: Framework Integration
description: Integrate <copio-scanner> and <copio-handoff> in React, Vue, Angular, Svelte, and Vanilla TypeScript.
section: Guides
order: 4
slug: framework-integration
---

# Framework Integration

Because `<copio-scanner>` and `<copio-handoff>` are standard Web Components with `bubbles: true, composed: true` `CustomEvent`s, they work across all major frameworks.

## Vanilla JavaScript / TypeScript

`@copio/sdk` ships TypeScript declarations (`HTMLElementTagNameMap`) so `document.querySelector('copio-scanner')` is fully typed:

```ts
import '@copio/sdk/scanner';
import { COPIO_EVENTS, setAssetBase } from '@copio/sdk';

setAssetBase('/assets/copio/');

const scanner = document.querySelector('copio-scanner')!;
scanner.addEventListener(COPIO_EVENTS.SCAN_COMPLETE, (e) => {
  console.log('Scanned pages:', e.detail.pages);
});
```

## React

In React 19+, custom elements and custom events work directly. In React 18 and earlier, attach `copio:*` event listeners via a `ref`:

```tsx
import { useEffect, useRef } from 'react';
import '@copio/sdk/scanner';
import { COPIO_EVENTS, setAssetBase, type CopioScanner } from '@copio/sdk';

setAssetBase('/assets/copio/');

export function DocumentScanner({ onComplete }: { onComplete: (pages: unknown[]) => void }) {
  const ref = useRef<CopioScanner | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      onComplete(detail.pages);
    };
    el.addEventListener(COPIO_EVENTS.SCAN_COMPLETE, handler);
    return () => el.removeEventListener(COPIO_EVENTS.SCAN_COMPLETE, handler);
  }, [onComplete]);

  return <copio-scanner ref={ref} mode="batch" theme="dark" />;
}
```

## Vue 3

Configure Vite/Vue to treat `copio-*` tags as custom elements and exclude `@copio/sdk` from Vite's `optimizeDeps` pre-bundler:

```js
// vite.config.js
vue({
  template: {
    compilerOptions: {
      isCustomElement: (tag) => tag.startsWith('copio-'),
    },
  },
});
// Also set optimizeDeps: { exclude: ['@copio/sdk'] } and build: { target: 'es2022' }
```

```vue
<template>
  <copio-scanner mode="batch" theme="dark" @copio:scan-complete="onScanComplete" />
</template>

<script setup>
import '@copio/sdk/scanner';

function onScanComplete(event) {
  console.log(event.detail.pages);
}
</script>
```

## Angular

Add `CUSTOM_ELEMENTS_SCHEMA` to your standalone component or NgModule, and attach `copio:*` event listeners via `@ViewChild` (Angular's template syntax reserves `:` for global targets like `window:`):

```ts
import { AfterViewInit, Component, CUSTOM_ELEMENTS_SCHEMA, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import '@copio/sdk/scanner';
import { COPIO_EVENTS, type CopioScanner } from '@copio/sdk';

@Component({
  selector: 'app-scanner',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<copio-scanner #scanner mode="single"></copio-scanner>`,
})
export class ScannerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('scanner', { static: true }) scannerRef!: ElementRef<CopioScanner>;

  private onScanComplete = (event: Event) => {
    console.log((event as CustomEvent).detail);
  };

  ngAfterViewInit() {
    this.scannerRef.nativeElement.addEventListener(COPIO_EVENTS.SCAN_COMPLETE, this.onScanComplete);
  }

  ngOnDestroy() {
    this.scannerRef.nativeElement.removeEventListener(COPIO_EVENTS.SCAN_COMPLETE, this.onScanComplete);
  }
}
```

## Svelte

```svelte
<script>
  import '@copio/sdk/scanner';
  function handleComplete(event) {
    console.log(event.detail.pages);
  }
</script>

<copio-scanner mode="batch" on:copio:scan-complete={handleComplete} />
```

## Runnable Examples & 1-Click Cloud Sandboxes

Complete starter apps for **Vanilla JS**, **React 19**, **Vue 3**, and **Angular 19** live in [`examples/`](https://github.com/edwilliams/copio/tree/master/examples) — each installs `@copio/sdk`, renders `<copio-scanner>`, listens to `copio:scan-complete`, and exports a PDF.

| Framework | Local (`npm i && npm run dev`) | StackBlitz (1-Click) |
|---|---|---|
| **Vanilla JS** | `examples/vanilla` | [Open in StackBlitz](https://stackblitz.com/github/edwilliams/copio/tree/master/examples/vanilla) |
| **React 19** | `examples/react` | [Open in StackBlitz](https://stackblitz.com/github/edwilliams/copio/tree/master/examples/react) |
| **Vue 3** | `examples/vue` | [Open in StackBlitz](https://stackblitz.com/github/edwilliams/copio/tree/master/examples/vue) |
| **Angular 19** | `examples/angular` | [Open in StackBlitz](https://stackblitz.com/github/edwilliams/copio/tree/master/examples/angular) |

Want a full cloud VS Code environment? Launch the repo's `.devcontainer` in GitHub Codespaces:

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/edwilliams/copio)
