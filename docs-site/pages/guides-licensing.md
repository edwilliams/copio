---
title: Licensing & Privacy
description: AGPL-3.0 open-source licensing, commercial options, license-key status, and zero-telemetry architecture.
section: Guides
order: 3
slug: licensing
---

# Licensing & Privacy

## Dual Licensing Model

`@copio/sdk` is published under the **GNU Affero General Public License v3.0 (`AGPL-3.0`)** for open-source projects, evaluation, and AGPL-compatible applications.

- **Open Source (`AGPL-3.0`)**: Use the full SDK freely under the terms of `LICENSE` in the repository root.
- **Commercial Licence**: Available for proprietary SaaS and closed-source products that cannot comply with AGPL-3.0 source-disclosure requirements.

## `license-key` Attribute & `licenseKey` Property

Both `<copio-scanner>` and `CopioEngine` accept a `license-key` attribute / `licenseKey` property:

```html
<copio-scanner license-key="YOUR_KEY"></copio-scanner>
```

Ahead of commercial key issuance and client-side verification, `license-key` / `licenseKey` is retained as a **documented no-op** so host integrations can wire their configuration without breaking changes when commercial licensing is enabled.

## Zero Telemetry & Client-Side Privacy

`@copio/sdk` includes **no analytics, no telemetry, and no phone-home requests**:

- Camera capture, edge detection, perspective warp, OCR (Tesseract WASM), and PDF compilation all execute locally in the browser.
- Phone-to-desktop handoff (`<copio-handoff>`) encrypts page payloads end-to-end with **ECDH P-256 + AES-GCM** before sending them over a WebRTC DataChannel.

## Third-Party Notices

Bundled and lazy-loaded third-party libraries (such as Tesseract.js, PDFKit, JSZip, PeerJS, and QRCode) are attributed in `THIRD_PARTY_NOTICES.md` included in the `@copio/sdk` npm package.
