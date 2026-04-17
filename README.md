# Copio

<div align="center">
  <img style="margin: 0 auto;" src="https://substackcdn.com/image/fetch/w_1456,c_limit,f_webp,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F4eb7cf55-5d05-497a-8745-9002f292c32a_512x512.png" />
</div>

<br/>

<div align="center">

![Offline Ready](https://img.shields.io/badge/offline-ready-brightgreen)
![PWA](https://img.shields.io/badge/PWA-installable-blue)
![Android TWA](https://img.shields.io/badge/Android-TWA%20APK-3ddc84)
![Built with Lit](https://img.shields.io/badge/built%20with-Lit-purple)
![No Framework](https://img.shields.io/badge/framework-none-lightgrey)

</div>

---

## About

Copio is an offline-first document scanning and management app that runs entirely in the browser. Capture pages with your camera, crop and adjust them, organise multi-page documents, and export to PDF — no server required.

The vision behind Copio is written up here: https://edwilliams.substack.com/p/copio

The project began around 2019. The original version was built in React. In 2026 it was completely rewritten using Claude Code over a few evenings as an exploration into vibe coding. This version uses Web Components (via Lit) with no framework overhead.

## Features

**Scanning & Capture**
- Photograph pages directly from your device camera
- EXIF-aware image orientation correction

**Editing**
- Per-page crop and rotation with an interactive cropper
- Drag-to-reorder pages within a document
- Add, remove, or replace individual pages at any time

**Export**
- Export any document as a multi-page PDF
- PDF generation happens fully client-side (no upload)

**Sync**
- Peer-to-peer device sync over WebRTC — no account needed
- QR code pairing to connect a second device instantly

**Offline**
- Service Worker caches all app assets on first load
- Fully functional with no network connection after install
- Installable as a PWA on iOS, Android, and desktop

## Tech Stack

| Library | Purpose |
|---|---|
| [Lit](https://lit.dev) | Web Components base class and templating |
| [TinyBase](https://tinybase.org) | Reactive in-browser store, persisted to IndexedDB |
| [Shoelace](https://shoelace.style) | UI component library (dialogs, alerts, icons) |
| [Cropper.js](https://fengyuanchen.github.io/cropperjs/) | Interactive image crop and rotate |
| [PDFKit](https://pdfkit.org) | Client-side PDF generation |
| [PeerJS](https://peerjs.com) | WebRTC peer-to-peer sync |
| [QRCode.js](https://davidshimjs.github.io/qrcodejs/) | QR code generation for device pairing |
| [Sortable.js](https://sortablejs.github.io/Sortable/) | Drag-to-reorder page list |
| [Exifr](https://mutiny.cz/exifr/) | EXIF metadata extraction for image orientation |

## Getting Started

**Prerequisites**
- Node.js (for the build script only — the app itself has no runtime dependencies)
- A static file server or a host that supports HTTPS (required for the Service Worker)

**Install**

```bash
git clone <repo-url>
cd copio
npm install
```

**Build**

```bash
npm run build
```

This runs the bundler in `scripts/bundle/` which produces the files in `js/`.

**Run locally**

Serve the project root with any static server. The Service Worker only activates on HTTPS or `localhost`:

```bash
npx serve .
# or
python3 -m http.server 3000
```

Open `http://localhost:3000` in your browser.

## Usage

1. **Create a document** — tap the **+** button and give it a name.
2. **Add pages** — open the document, tap the camera icon, and capture or select an image.
3. **Edit pages** — tap any page thumbnail to crop, rotate, or remove it. Drag thumbnails to reorder.
4. **Export** — tap the PDF export button to download the document as a PDF.

## Android APK (TWA)

Copio is available as a native-feeling Android app via a [Trusted Web Activity (TWA)](https://developer.chrome.com/docs/android/trusted-web-activity/) — a lightweight APK shell that runs the web app full-screen with no browser chrome.

**Install from the APK**

Download `app-release-signed.apk` from the [`copio-twa/`](../copio-twa/) directory (next to this repo) and transfer it to your Android device.

On your device:
1. Open the APK file — Android will prompt you to install it.
2. If prompted, allow "Install from unknown sources" in Settings.
3. Tap **Install**.

Or install via ADB:
```bash
adb install app-release-signed.apk
```

**Build your own APK**

You'll need Node.js, a JDK (17+), and the Android SDK.

```bash
# Install the Bubblewrap CLI
npm install -g @bubblewrap/cli

# Create a project directory and add a twa-manifest.json
# (see copio-twa/twa-manifest.json for the full config)
mkdir copio-twa && cd copio-twa

# Generate the Android project
bubblewrap update --skipVersionUpgrade

# Build the signed APK
BUBBLEWRAP_KEYSTORE_PASSWORD=<your-password> \
BUBBLEWRAP_KEY_PASSWORD=<your-password> \
bubblewrap build
```

The output is `app-release-signed.apk` (sideload) and `app-release-bundle.aab` (Play Store).

**Address bar removal**

The browser address bar is hidden automatically once the [`/.well-known/assetlinks.json`](.well-known/assetlinks.json) file on the host is verified against the APK's signing certificate. This file is already committed and deployed.

---

## PWA & Offline

On first load the Service Worker fetches `files-to-cache.json` and pre-caches all app assets. Subsequent loads are served from cache, so the app works with no network connection.

To install Copio as an app, use your browser's "Add to Home Screen" / "Install app" prompt. This gives it a standalone window, a home screen icon, and full offline access.

When a new version is deployed the Service Worker will detect the updated cache, prompt the user to reload, and swap in the new assets.

## Device Sync

Copio supports peer-to-peer sync between two devices using WebRTC (via PeerJS). No account or server is needed — documents are transferred directly between browsers.

To sync:
1. On the **host** device, open the sync panel and share the QR code.
2. On the **joining** device, scan the QR code (or follow the link).
3. The joining device connects and receives the document data.

The connection is transient — there is no persistent cloud sync.

## Deployment

1. Bump `CACHE_NAME` in `sw.js` (e.g. `copio-cache-v3`) so existing clients pick up the new build.
2. Regenerate `files-to-cache.json` to include any new or renamed assets.
3. Deploy to any static host. **HTTPS is required** for the Service Worker to register on non-localhost origins.

## Contributing

Contributions, bug reports, and ideas are welcome. Open an issue or a pull request.

## License

MIT
