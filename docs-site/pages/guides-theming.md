---
title: Theming & CSS Parts
description: Customize <copio-scanner> and <copio-handoff> using themes, CSS custom properties, ::part() selectors, and adoptedStyleSheets.
section: Guides
order: 2
slug: theming
---

# Theming & CSS Parts

`<copio-scanner>` and `<copio-handoff>` encapsulate their styles inside Shadow DOM using constructable stylesheets (`adoptedStyleSheets`), preventing host CSS from breaking scanner layouts while exposing design tokens and `::part()` hooks.

## Built-in Light & Dark Themes

Set the `theme` attribute on either component:

```html
<copio-scanner theme="light"></copio-scanner>
<copio-handoff theme="dark"></copio-handoff>
```

Both components also automatically detect common host theme markers (`[data-theme="light"]`, `.sl-theme-light`, `.theme-light`) via `:host-context(...)`.

## CSS Custom Properties

Override any `--copio-*` token from your host stylesheet. Custom properties inherit cleanly across the Shadow DOM boundary:

```css
copio-scanner,
copio-handoff {
  --copio-color-bg: #090d16;
  --copio-color-surface: #111827;
  --copio-color-primary: #10b981;
  --copio-color-primary-hover: #34d399;
  --copio-color-primary-contrast: #052e16;
  --copio-radius-md: 12px;
  --copio-font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
}
```

See the [API Reference](/docs/api/) for the complete list of CSS custom properties generated from the Custom Elements Manifest.

## Styling Internal Regions with `::part()`

`<copio-scanner>` exposes named Shadow DOM parts for fine-grained host styling:

```css
copio-scanner::part(header) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

copio-scanner::part(toolbar) {
  padding-inline: 16px;
}
```

Available parts: `scanner-root`, `header`, `header-actions`, `viewfinder`, `shutter-dock`, `workbench`, `filmstrip`, `toolbar`, `ocr-sheet`, `handoff-progress`, and `handoff-confirm`.

## Constructable Stylesheets for Custom Shadow Hosts

If you embed scanner or handoff styles in your own Shadow DOM wrapper or strict CSP environment, use the exported style helpers from `@copio/sdk/scanner` or `@copio/sdk/handoff`:

```js
import { adoptScannerStyles, getScannerStyleSheet } from '@copio/sdk/scanner';
import { adoptHandoffStyles } from '@copio/sdk/handoff';

adoptScannerStyles(myShadowRoot);
adoptHandoffStyles(myOtherShadowRoot);
```
