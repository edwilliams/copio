# `@copio/sdk` Framework Examples

Minimal, runnable starter projects demonstrating `<copio-scanner>`, listening to `copio:scan-complete`, and exporting a multi-page PDF across major frameworks.

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/edwilliams/copio)

## Examples

| Framework | Directory | Local Dev | 1-Click Online Demo |
|---|---|---|---|
| **Vanilla JS** (Vite) | [`examples/vanilla`](./vanilla) | `cd examples/vanilla && npm i && npm run dev` | [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/edwilliams/copio/tree/master/examples/vanilla) |
| **React 19** (Vite + TS) | [`examples/react`](./react) | `cd examples/react && npm i && npm run dev` | [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/edwilliams/copio/tree/master/examples/react) |
| **Vue 3** (Vite + TS) | [`examples/vue`](./vue) | `cd examples/vue && npm i && npm run dev` | [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/edwilliams/copio/tree/master/examples/vue) |
| **Angular 19** (Standalone + TS) | [`examples/angular`](./angular) | `cd examples/angular && npm i && npm run dev` | [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/edwilliams/copio/tree/master/examples/angular) |

## What Each Example Demonstrates

1. Installing `@copio/sdk` and serving its lazy runtime assets (`dist/assets` and `dist/js`) at `/copio-sdk` via `setAssetBase('/copio-sdk')`.
2. Rendering `<copio-scanner mode="batch" aspect="a4" theme="dark">` inside a sized container.
3. Listening to the `copio:scan-complete` (`COPIO_EVENTS.SCAN_COMPLETE`) custom event.
4. Exporting a compiled PDF via `scanner.exportPdf({ docName, download: true })`.

## CI Smoke Test

Verify all four examples install and build cleanly against the local SDK package:

```bash
npm run check:examples
```
