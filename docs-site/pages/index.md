---
title: Copio SDK Documentation
description: Embeddable Web Components and headless services for document scanning, non-destructive editing, client-side OCR, PDF export, and E2EE phone-to-desktop handoff.
section: Overview
order: 1
slug: index
embeds: true
---

# Copio SDK Documentation

**Copio** (`@copio/sdk`) is an embeddable, client-side document scanning SDK built with standard Web Components and a headless hexagonal core.

> All image processing, edge detection, perspective correction, OCR, and PDF generation run **100% locally in the browser** — no document uploads to third-party servers required.

## Live `<copio-scanner>` Embed

Try the interactive `<copio-scanner>` component directly on this documentation page. Switch between **Single** and **Batch** modes or toggle the theme below:

<div class="docs-embed-card" data-embed-scanner>
  <div class="docs-embed-toolbar">
    <span class="docs-embed-title">&lt;copio-scanner&gt;</span>
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

## What's Inside `@copio/sdk`

| Entry Point | Purpose |
|---|---|
| `@copio/sdk` | Batteries-included entry: `<copio-scanner>`, `<copio-handoff>`, `CopioEngine`, and default adapters |
| `@copio/sdk/scanner` | Self-contained `<copio-scanner>` Web Component bundle |
| `@copio/sdk/handoff` | `<copio-handoff>` desktop QR widget & E2EE WebRTC session |
| `@copio/sdk/core` | Zero-DOM headless `CopioEngine`, domain models, and storage ports |
| `@copio/sdk/sync` | `SyncManager` for P2P document synchronization |

## Next Steps

- Follow the [Quickstart](/docs/getting-started/) to install `@copio/sdk` and embed `<copio-scanner>` in minutes.
- Explore the [`<copio-scanner>` guide](/docs/scanner/) for modes, aspect presets, and CSS theming.
- Learn about [Phone-to-Desktop Handoff](/docs/handoff/) with `<copio-handoff>`.
