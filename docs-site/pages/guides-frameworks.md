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

Configure Vite/Vue to treat `copio-*` tags as custom elements:

```js
// vite.config.js
vue({
  template: {
    compilerOptions: {
      isCustomElement: (tag) => tag.startsWith('copio-'),
    },
  },
});
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

Add `CUSTOM_ELEMENTS_SCHEMA` to your standalone component or NgModule:

```ts
import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import '@copio/sdk/scanner';

@Component({
  selector: 'app-scanner',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <copio-scanner
      mode="single"
      (copio:scan-complete)="onScanComplete($event)">
    </copio-scanner>
  `,
})
export class ScannerComponent {
  onScanComplete(event: Event) {
    console.log((event as CustomEvent).detail);
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
