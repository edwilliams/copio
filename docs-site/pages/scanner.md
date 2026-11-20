---
title: <copio-scanner>
description: Embeddable two-stage document scanner Web Component with Shadow DOM encapsulation, container queries, and CSS custom properties.
section: Components
order: 1
slug: scanner
embeds: true
---

# `<copio-scanner>`

`<copio-scanner>` is a self-contained Web Component using Shadow DOM and CSS `@container` queries so it adapts cleanly to modals, drawers, inline cards, or full-screen mobile viewports without leaking styles.

## Attributes

| Attribute | Values | Default | Description |
|---|---|---|---|
| `mode` | `single` \| `batch` | `single` | Single-shot capture or multi-page batch session |
| `aspect` | `receipt` \| `a4` \| `id-card` \| `free` | `free` | Viewfinder & crop aspect guide |
| `theme` | `dark` \| `light` | `dark` | Built-in color theme |
| `asset-base` | URL string | `""` | Base URL for lazy worker/WASM assets |

## Interactive Playground

<div class="docs-embed-card" data-embed-scanner>
  <div class="docs-embed-toolbar">
    <span class="docs-embed-title">&lt;copio-scanner&gt; Controls</span>
    <div class="docs-embed-controls">
      <button type="button" class="docs-embed-btn" data-scanner-attr="mode" data-scanner-val="single" aria-pressed="true">Single</button>
      <button type="button" class="docs-embed-btn" data-scanner-attr="mode" data-scanner-val="batch" aria-pressed="false">Batch</button>
      <button type="button" class="docs-embed-btn" data-scanner-attr="theme" data-scanner-val="dark" aria-pressed="true">Dark</button>
      <button type="button" class="docs-embed-btn" data-scanner-attr="theme" data-scanner-val="light" aria-pressed="false">Light</button>
    </div>
  </div>
  <div class="docs-embed-stage">
    <copio-scanner mode="single" aspect="receipt" theme="dark" asset-base="/dist/"></copio-scanner>
  </div>
</div>

## Theming with CSS Custom Properties

Customize `<copio-scanner>` from your host stylesheet using standard CSS custom properties:

```css
copio-scanner {
  --copio-accent: #10b981;
  --copio-bg: #0b0f17;
  --copio-radius: 12px;
}
```
