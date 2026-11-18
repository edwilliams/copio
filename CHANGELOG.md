# Changelog

All notable changes to `@copio/sdk` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

## [0.1.6] - 2026-11-06
- Legacy app cleanup and `<copio-scanner>` bundle size reduction (CPO-068).
- Phone-to-desktop handoff, Copio Relay, and edge detection / perspective correction milestones.

## [0.1.0] - 2026-10-20
- Initial `@copio/sdk` release (`<copio-scanner>`, `CopioEngine`, Ports & Adapters, OCR/PDF/Sync).
