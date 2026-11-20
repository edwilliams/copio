---
title: <copio-handoff>
description: Zero-backend QR-to-WebRTC end-to-end encrypted phone-to-desktop document handoff widget.
section: Components
order: 2
slug: handoff
embeds: true
---

# `<copio-handoff>`

`<copio-handoff>` lets desktop web applications pair with a user's smartphone camera via a QR code and stream scanned pages over an **end-to-end encrypted (E2EE) WebRTC DataChannel**.

> `@experimental`: `<copio-handoff>` and `HandoffSession` are stabilizing ahead of v1.0.

## How Handoff Works

1. Desktop mounts `<copio-handoff>`, generating an ephemeral ECDH/AES-GCM session keypair and QR code.
2. User scans the QR code on their phone, opening `<copio-scanner>` in mobile handoff sender mode.
3. Both peers establish a WebRTC DataChannel and exchange encrypted page blobs directly peer-to-peer.
4. Desktop receives verified attachments via `copio:*` events.

## Live `<copio-handoff>` Preview

<div class="docs-embed-card">
  <div class="docs-embed-toolbar">
    <span class="docs-embed-title">&lt;copio-handoff&gt;</span>
    <span class="docs-version-badge">@experimental</span>
  </div>
  <div class="docs-embed-stage">
    <copio-handoff id="docs-handoff-embed" theme="dark"></copio-handoff>
    <script>
      (function () {
        var el = document.getElementById('docs-handoff-embed');
        if (el && typeof location !== 'undefined') {
          el.setAttribute('receiver-url', location.origin + '/');
        }
      })();
    </script>
  </div>
</div>

## Usage

Set `receiver-url` to the page hosting your mobile `<copio-scanner>` sender endpoint (for example `/` in the Copio sandbox):

```html
<copio-handoff theme="dark" receiver-url="https://copio.netlify.app/"></copio-handoff>
```

```js
import '@copio/sdk/handoff';
```
