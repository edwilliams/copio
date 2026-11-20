# Changelog

All notable changes to `@copio/sdk` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed (CPO-062)
- Auto-resolved `assetBase` from `import.meta.url` in `sdk/cdn.js` (`dist/cdn.js`) when not explicitly configured, enabling zero-config CDN and self-hosted `dist/` usage.
- Added cross-origin `Blob` module worker support and `assetBase`-aware inline fallback in `ScanicWasmEdgeAdapter`, plus dynamic `pdf.worker.min.mjs` `workerSrc` resolution in `pdf-utils.js`.
- Deduplicated runtime worker/WASM/ML assets in `scripts/build-sdk.mjs` so `tesseract-core/`, `scanic-ml/`, and worker scripts live once in `dist/js/lib/` instead of being duplicated in `dist/assets/`.
- Documented the three official consumption modes (Bundler/npm, CDN pinned to `@copio/sdk@1`, and Zero-build self-hosted) in `README.md`.

## [0.1.8] - 2026-11-19

### Fixed
- Included `dist/assets/` and `dist/js/` in `package.json` `"files"` so worker, WASM, and ML runtime assets (Scanic edge detection, Tesseract OCR, PDF.js) are published in the `@copio/sdk` npm tarball.
- Copied Scanic ML detector and ONNX Runtime WASM assets (`scanic-mlDetector.js`, `scanic-ort.wasm.min.js`, `scanic-ml/`) into `dist/assets/` alongside `scanic-detector.js` in `scripts/build-sdk.mjs`.
## [0.1.7] - 2026-11-18

### Added
- Standalone mobile scanner test harness for verifying capture, crop, and export flows on real devices.

### Changed (Breaking — Pre-1.0 Public API Audit, CPO-067)
- Audited and locked the v1.0 public API surface across `.`, `./core`, `./scanner`, `./sync`, and `./handoff` (documented in [ADR 0004](docs/adr/0004-public-api-v1.md) and enforced by snapshot tests in `test/sdk-public-api.test.js`).
- Marked `CopioHandoff`, `HandoffSession`, `LoopbackTransport`, and `ScanicWasmEdgeAdapter` with `@experimental` JSDoc.
- Documented `license-key` / `licenseKey` as a no-op until commercial licensing (E4 / CPO-053) is implemented.

### Removed (Breaking — Pre-1.0 Public API Audit, CPO-067)
- Removed `LicenseManager` and `BUILD_DATE` from `@copio/sdk` root exports until CPO-053.
- Removed app-only dialogs (`CopioDocOcrDialog`, `CopioSyncDialog`) from `@copio/sdk` and `@copio/sdk/sync`.
- Removed internal utilities and lazy-loader helpers from `@copio/sdk` root exports (use `@copio/sdk/core`, `@copio/sdk/scanner`, `@copio/sdk/sync`, or `@copio/sdk/handoff` where applicable):
  - `scannerCss`, `getScannerStyleSheet`, `adoptScannerStyles` (available on `@copio/sdk/scanner`)
  - `handoffCss`, `getHandoffStyleSheet`, `adoptHandoffStyles`, `randomHandoffId`, `encodeSessionToken`, `decodeSessionToken`, `buildHandoffUrl`, `parseHandoffUrl` (available on `@copio/sdk/handoff`)
  - `SyncManager` (available on `@copio/sdk/sync`)
  - `dispatchCopioEvent`, `DocRepository`, `docRepository`, `DEFAULT_MIGRATIONS`, `DEFAULT_FALLBACK_QUAD`, `cloneQuad`, `quadToCropRect`, `normalizeEditStack`, `normalizeQuad`, `cropRectToQuad`, `rotateQuad`, `quadOriginalToRotated`, `quadRotatedToOriginal`, `hasActiveEdits`, `randomId`, `fileToBase64`, `thresholdSrc`, `rotateSrc`, `getCroppedSrc`, `extractExif` (available on `@copio/sdk/core`)
  - `getOcrWorker`, `terminateOcrWorker`, `SUPPORTED_LANGUAGES`, `notify`, `setContainer`, `getContainer`, `clearNotifications`, `renderPdfPagesToDataUrls`, `resolveAssetUrl`, `loadScript`, `loadCropper`, `loadPdfKit`, `loadJsZip`, `loadPeerJs`, `loadQrCode`, `loadTesseract`, `probeOpfs`

## [0.1.6] - 2026-11-14

### Added
- Phone-to-Desktop Handoff (`<copio-handoff>`, E2EE WebRTC streaming, mobile sender mode, Copio Relay kit, and interactive sandbox demo; CPO-090–CPO-094).
- Auto edge detection (Scanic WASM worker + `EdgeDetectorPort` adapter, live viewfinder quad overlay, pre-filled crop) and 4-corner perspective correction (CPO-073–CPO-076).
- Data migration framework with `MigrationRunner` and schema versioning (CPO-013).
- Batch capture device verification & hardening (CPO-072).

### Changed
- Removed legacy full-app SPA leftovers from `copio` and reduced `<copio-scanner>` gzip bundle size (CPO-068).
- Dual-licensed repository under AGPL-3.0 / commercial terms with CLA (CPO-050, CPO-051).

## [0.1.2] - 2026-11-01

### Added
- Self-contained `<copio-scanner>` bundle (`dist/scanner.js`) for zero-config drop-in consumption (CPO-049).
- `prepare` script (`scripts/sync-vendor-types.mjs`) for automatic vendor type syncing on install.

### Changed
- Cleaned up `package.json` dependencies for downstream npm consumers.

## [0.1.1] - 2026-11-01

### Changed
- Adjusted `@copio/sdk` package exports map, `files` whitelist, and `sideEffects` metadata for npm distribution.

## [0.1.0] - 2026-10-20

### Added
- Initial `@copio/sdk` release (`<copio-scanner>`, `CopioEngine`, Ports & Adapters, Tesseract WASM OCR, PDFKit / Searchable PDF export, and P2P Sync).

[Unreleased]: https://github.com/edwilliams/copio/compare/v0.1.8...HEAD
[0.1.8]: https://github.com/edwilliams/copio/compare/v0.1.7...v0.1.8
[0.1.7]: https://github.com/edwilliams/copio/releases/tag/v0.1.7
[0.1.6]: https://github.com/edwilliams/copio/releases/tag/v0.1.6
[0.1.2]: https://github.com/edwilliams/copio/releases/tag/v0.1.2
[0.1.1]: https://github.com/edwilliams/copio/releases/tag/v0.1.1
[0.1.0]: https://github.com/edwilliams/copio/releases/tag/v0.1.0
