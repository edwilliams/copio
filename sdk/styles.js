/**
 * Copio Scanner Encapsulated Styles & Design Tokens (CPO-032 / CPO-038)
 * 
 * Provides constructable stylesheets and adoptedStyleSheets architecture for <copio-scanner>
 * with complete Shadow DOM style encapsulation, zero global leakage, and hostile host immunity.
 */

export const scannerCss = `
/* ==========================================================================
   1. HOST RESET & BOUNDARY ENCAPSULATION
   all: initial isolates inherited typography, line-height, text-align, etc.
   ========================================================================== */
:host {
  all: initial;
  display: block;
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 200px;
  container-type: size;
  container-name: copio-scanner;
  overflow: hidden;
  contain: layout;
  box-sizing: border-box;
  text-align: left;
  direction: ltr;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;

  /* Typography Design Tokens */
  --copio-font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --copio-font-mono: 'JetBrains Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;

  /* Surface & Background Tokens (Default Dark) */
  --copio-color-bg: #0b0f17;
  --copio-color-surface: #131b26;
  --copio-color-surface-elevated: #1c2736;
  --copio-color-surface-overlay: rgba(15, 22, 32, 0.88);
  --copio-color-stage-bg: #070a0f;

  /* Text & Iconography Tokens */
  --copio-color-text: #f1f5f9;
  --copio-color-text-muted: #94a3b8;
  --copio-color-text-inverse: #090d14;

  /* Brand & Semantic Accent Tokens */
  --copio-color-primary: #38bdf8;
  --copio-color-primary-hover: #7dd3fc;
  --copio-color-primary-contrast: #06131f;
  --copio-color-success: #22c55e;
  --copio-color-warning: #f59e0b;
  --copio-color-danger: #ef4444;

  /* Borders, Dividers & Focus Rings */
  --copio-color-border: rgba(148, 163, 184, 0.18);
  --copio-color-border-strong: rgba(148, 163, 184, 0.34);
  --copio-focus-ring: 0 0 0 2px #0b0f17, 0 0 0 4px #38bdf8;

  /* Geometry, Spacing & Touch Ergonomics (>=44px touch targets) */
  --copio-radius-sm: 6px;
  --copio-radius-md: 10px;
  --copio-radius-lg: 14px;
  --copio-radius-pill: 9999px;
  --copio-spacing-xs: 4px;
  --copio-spacing-sm: 8px;
  --copio-spacing-md: 12px;
  --copio-spacing-lg: 16px;
  --copio-spacing-xl: 24px;
  --copio-touch-target-min: 44px;
  --copio-crop-handle-hit: 48px;
  --copio-crop-handle-visual: 16px;
  --copio-shadow-elevated: 0 12px 32px -4px rgba(0, 0, 0, 0.55);
  --copio-transition-fast: 150ms cubic-bezier(0.22, 1, 0.36, 1);
  --copio-transition-normal: 240ms cubic-bezier(0.22, 1, 0.36, 1);

  /* Shoelace Theme Mapping */
  --sl-font-sans: var(--copio-font-family);
  --sl-font-mono: var(--copio-font-mono);
  --sl-color-primary-50: #f0f9ff;
  --sl-color-primary-100: #e0f2fe;
  --sl-color-primary-200: #bae6fd;
  --sl-color-primary-300: #7dd3fc;
  --sl-color-primary-400: #38bdf8;
  --sl-color-primary-500: #0ea5e9;
  --sl-color-primary-600: var(--copio-color-primary);
  --sl-color-primary-700: #0369a1;
  --sl-color-primary-800: #075985;
  --sl-color-primary-900: #0c4a6e;
  --sl-color-primary-950: #082f49;

  font-family: var(--copio-font-family);
  font-size: 14px;
  line-height: 1.5;
  color: var(--copio-color-text);
  background-color: var(--copio-color-bg);
  color-scheme: dark;
}

/* Explicit Dark Theme Override */
:host([theme="dark"]),
:host(.copio-theme-dark),
:host-context([data-theme="dark"]),
:host-context(.sl-theme-dark),
:host-context(.theme-dark) {
  --copio-color-bg: #0b0f17;
  --copio-color-surface: #131b26;
  --copio-color-surface-elevated: #1c2736;
  --copio-color-surface-overlay: rgba(15, 22, 32, 0.88);
  --copio-color-stage-bg: #070a0f;
  --copio-color-text: #f1f5f9;
  --copio-color-text-muted: #94a3b8;
  --copio-color-text-inverse: #090d14;
  --copio-color-primary: #38bdf8;
  --copio-color-primary-hover: #7dd3fc;
  --copio-color-primary-contrast: #06131f;
  --copio-color-success: #22c55e;
  --copio-color-warning: #f59e0b;
  --copio-color-danger: #ef4444;
  --copio-color-border: rgba(148, 163, 184, 0.18);
  --copio-color-border-strong: rgba(148, 163, 184, 0.34);
  --copio-focus-ring: 0 0 0 2px #0b0f17, 0 0 0 4px #38bdf8;
  --copio-radius-sm: 6px;
  --copio-radius-md: 10px;
  --copio-radius-lg: 14px;
  --copio-shadow-elevated: 0 12px 32px -4px rgba(0, 0, 0, 0.55);
  color-scheme: dark;
}

/* Light Theme Override */
:host([theme="light"]),
:host(.copio-theme-light),
:host-context([data-theme="light"]),
:host-context(.sl-theme-light),
:host-context(.theme-light) {
  --copio-color-bg: #f8fafc;
  --copio-color-surface: #ffffff;
  --copio-color-surface-elevated: #f1f5f9;
  --copio-color-surface-overlay: rgba(255, 255, 255, 0.92);
  --copio-color-stage-bg: #1e293b;
  --copio-color-text: #0f172a;
  --copio-color-text-muted: #475569;
  --copio-color-text-inverse: #ffffff;
  --copio-color-primary: #0284c7;
  --copio-color-primary-hover: #0369a1;
  --copio-color-primary-contrast: #ffffff;
  --copio-color-success: #16a34a;
  --copio-color-warning: #d97706;
  --copio-color-danger: #dc2626;
  --copio-color-border: rgba(15, 23, 42, 0.12);
  --copio-color-border-strong: rgba(15, 23, 42, 0.26);
  --copio-focus-ring: 0 0 0 2px #ffffff, 0 0 0 4px #0284c7;
  --copio-radius-sm: 6px;
  --copio-radius-md: 10px;
  --copio-radius-lg: 14px;
  --copio-shadow-elevated: 0 12px 28px -4px rgba(15, 23, 42, 0.18);
  color-scheme: light;
}

/* Brand Theme Override (Emerald) */
:host([theme="brand"]),
:host(.copio-theme-brand),
:host-context([data-theme="brand"]),
:host-context(.theme-brand) {
  --copio-color-bg: #0f111a;
  --copio-color-surface: #181b28;
  --copio-color-surface-elevated: #23273a;
  --copio-color-surface-overlay: rgba(24, 27, 40, 0.90);
  --copio-color-stage-bg: #090a10;
  --copio-color-text: #f8fafc;
  --copio-color-text-muted: #9ca3af;
  --copio-color-text-inverse: #ffffff;
  --copio-color-primary: #10b981;
  --copio-color-primary-hover: #34d399;
  --copio-color-primary-contrast: #042f2e;
  --copio-color-success: #10b981;
  --copio-color-warning: #f59e0b;
  --copio-color-danger: #ef4444;
  --copio-color-border: rgba(16, 185, 129, 0.22);
  --copio-color-border-strong: rgba(16, 185, 129, 0.42);
  --copio-focus-ring: 0 0 0 2px #0f111a, 0 0 0 4px #10b981;
  --copio-radius-sm: 4px;
  --copio-radius-md: 8px;
  --copio-radius-lg: 12px;
  --copio-shadow-elevated: 0 12px 32px -4px rgba(0, 0, 0, 0.65);
  color-scheme: dark;
}

/* Auto Theme: follows prefers-color-scheme when theme is auto */
@media (prefers-color-scheme: light) {
  :host([theme="auto"]),
  :host(.copio-theme-auto) {
    --copio-color-bg: #f8fafc;
    --copio-color-surface: #ffffff;
    --copio-color-surface-elevated: #f1f5f9;
    --copio-color-surface-overlay: rgba(255, 255, 255, 0.92);
    --copio-color-stage-bg: #1e293b;
    --copio-color-text: #0f172a;
    --copio-color-text-muted: #475569;
    --copio-color-text-inverse: #ffffff;
    --copio-color-primary: #0284c7;
    --copio-color-primary-hover: #0369a1;
    --copio-color-primary-contrast: #ffffff;
    --copio-color-success: #16a34a;
    --copio-color-warning: #d97706;
    --copio-color-danger: #dc2626;
    --copio-color-border: rgba(15, 23, 42, 0.12);
    --copio-color-border-strong: rgba(15, 23, 42, 0.26);
    --copio-focus-ring: 0 0 0 2px #ffffff, 0 0 0 4px #0284c7;
    --copio-radius-sm: 6px;
    --copio-radius-md: 10px;
    --copio-radius-lg: 14px;
    --copio-shadow-elevated: 0 12px 28px -4px rgba(15, 23, 42, 0.18);
    color-scheme: light;
  }
}

/* ==========================================================================
   2. INTERNAL ELEMENT RESET (Scoped to Shadow DOM)
   ========================================================================== */
*, *::before, *::after {
  box-sizing: border-box;
}

::slotted(*) {
  box-sizing: border-box;
}

/* ==========================================================================
   3. ROOT CONTAINER & COMPONENT SHELL
   ========================================================================== */
.copio-scanner-container {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
  container-type: size;
  container-name: copio-scanner;
  contain: layout;
  background: var(--copio-color-bg);
  color: var(--copio-color-text);
  font-family: var(--copio-font-family);
  font-size: 14px;
  line-height: 1.5;
  text-align: left;
  direction: ltr;
  user-select: none;
}

/* Header (Shadow Part: header) */
.copio-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--copio-spacing-sm);
  padding: var(--copio-spacing-sm) var(--copio-spacing-md);
  background: var(--copio-color-surface);
  border-bottom: 1px solid var(--copio-color-border);
  min-height: 52px;
  flex-shrink: 0;
  z-index: 5;
  box-sizing: border-box;
}

.copio-header-left {
  display: flex;
  align-items: center;
  gap: var(--copio-spacing-sm);
  min-width: 0;
}

.copio-mode-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: var(--copio-radius-pill);
  background: var(--copio-color-surface-elevated);
  color: var(--copio-color-primary);
  border: 1px solid var(--copio-color-border);
  white-space: nowrap;
}

.copio-title-group {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.copio-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--copio-color-text);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.copio-subtitle {
  font-size: 11px;
  color: var(--copio-color-text-muted);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.copio-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

/* Touch-Safe Interactive Buttons (>=44px touch invariant) */
.copio-btn {
  appearance: none;
  border: 1px solid var(--copio-color-border);
  background: var(--copio-color-surface-elevated);
  color: var(--copio-color-text);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  min-height: var(--copio-touch-target-min);
  min-width: var(--copio-touch-target-min);
  padding: 0 12px;
  border-radius: var(--copio-radius-md);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  cursor: pointer;
  transition: all var(--copio-transition-fast);
  white-space: nowrap;
  text-decoration: none;
  box-sizing: border-box;
}

.copio-btn:hover {
  background: var(--copio-color-primary-hover);
  color: var(--copio-color-primary-contrast);
  border-color: var(--copio-color-primary);
}

.copio-btn-primary {
  background: var(--copio-color-primary);
  color: var(--copio-color-primary-contrast);
  border-color: var(--copio-color-primary);
}

.copio-btn-danger {
  background: rgba(239, 68, 68, 0.15);
  color: var(--copio-color-danger);
  border-color: rgba(239, 68, 68, 0.35);
}

.copio-btn-danger:hover {
  background: var(--copio-color-danger);
  color: #fff;
}

/* Viewfinder (Shadow Part: viewfinder) */
.copio-viewfinder {
  position: relative;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--copio-color-stage-bg);
  overflow: hidden;
  min-height: 0;
}

.copio-viewfinder-feed {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* Shutter Dock (Shadow Part: shutter-dock) */
.copio-shutter-dock {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--copio-spacing-md);
  background: var(--copio-color-surface);
  border-top: 1px solid var(--copio-color-border);
  min-height: 72px;
  flex-shrink: 0;
  z-index: 5;
}

.copio-shutter-btn {
  appearance: none;
  width: 64px;
  height: 64px;
  border-radius: var(--copio-radius-pill);
  border: 4px solid var(--copio-color-primary);
  background: transparent;
  padding: 4px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: transform var(--copio-transition-fast);
}

.copio-shutter-btn-inner {
  width: 100%;
  height: 100%;
  border-radius: var(--copio-radius-pill);
  background: var(--copio-color-primary);
  transition: transform var(--copio-transition-fast);
}

.copio-shutter-btn:active .copio-shutter-btn-inner {
  transform: scale(0.88);
}

/* Workbench & Filmstrip (Shadow Part: workbench) */
.copio-workbench {
  position: relative;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  background: var(--copio-color-stage-bg);
  overflow: hidden;
  min-height: 0;
}

.copio-stage-canvas {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  padding: var(--copio-spacing-sm);
}

.copio-stage-canvas img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  box-shadow: var(--copio-shadow-elevated);
  border-radius: var(--copio-radius-sm);
}

/* ==========================================================================
   NON-DESTRUCTIVE CROP OVERLAY (CPO-025)
   ========================================================================== */
.copio-crop-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  z-index: 8;
  touch-action: none;
}

.copio-crop-box {
  position: absolute;
  border: 2px solid var(--copio-color-primary);
  box-shadow: 0 0 0 9999px rgba(5, 8, 14, 0.68);
  cursor: move;
  touch-action: none;
  box-sizing: border-box;
}

/* Rule-of-thirds crop grid */
.copio-crop-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(to right, rgba(56, 189, 248, 0.28) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(56, 189, 248, 0.28) 1px, transparent 1px);
  background-size: 33.333% 33.333%;
}

/* 48px x 48px Touch Target Handles (exceeds 44px requirement) */
.copio-crop-handle {
  position: absolute;
  width: var(--copio-crop-handle-hit);
  height: var(--copio-crop-handle-hit);
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  touch-action: none;
  box-sizing: border-box;
}

.copio-crop-handle::after {
  content: '';
  width: var(--copio-crop-handle-visual);
  height: var(--copio-crop-handle-visual);
  border-radius: 50%;
  background: var(--copio-color-primary);
  border: 2.5px solid #ffffff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
  transition: transform 120ms ease;
  box-sizing: border-box;
}

.copio-crop-handle:hover::after,
.copio-crop-handle:active::after {
  transform: scale(1.25);
  background: var(--copio-color-success, #22c55e);
}

.copio-crop-handle.nw { top: -24px; left: -24px; cursor: nwse-resize; }
.copio-crop-handle.ne { top: -24px; right: -24px; cursor: nesw-resize; }
.copio-crop-handle.sw { bottom: -24px; left: -24px; cursor: nesw-resize; }
.copio-crop-handle.se { bottom: -24px; right: -24px; cursor: nwse-resize; }
.copio-crop-handle.n  { top: -24px; left: calc(50% - 24px); cursor: ns-resize; }
.copio-crop-handle.s  { bottom: -24px; left: calc(50% - 24px); cursor: ns-resize; }
.copio-crop-handle.w  { left: -24px; top: calc(50% - 24px); cursor: ew-resize; }
.copio-crop-handle.e  { right: -24px; top: calc(50% - 24px); cursor: ew-resize; }

/* Crop Sub-Toolbar Banner */
.copio-crop-banner {
  position: absolute;
  top: 8px;
  left: 12px;
  right: 12px;
  z-index: 12;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 8px;
  background: var(--copio-color-surface-overlay, rgba(15, 23, 42, 0.94));
  border: 1px solid var(--copio-color-primary);
  border-radius: var(--copio-radius-md);
  box-shadow: var(--copio-shadow-elevated);
}

.copio-crop-banner-text {
  font-size: 11px;
  font-weight: 600;
  color: var(--copio-color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.copio-filmstrip {
  display: flex;
  align-items: center;
  gap: var(--copio-spacing-sm);
  padding: var(--copio-spacing-sm) var(--copio-spacing-md);
  background: var(--copio-color-surface);
  border-top: 1px solid var(--copio-color-border);
  overflow-x: auto;
  min-height: 80px;
  flex-shrink: 0;
}

/* Toolbar (Shadow Part: toolbar) */
.copio-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-around;
  gap: var(--copio-spacing-xs);
  padding: var(--copio-spacing-sm);
  background: var(--copio-color-surface);
  border-top: 1px solid var(--copio-color-border);
  min-height: 56px;
  flex-shrink: 0;
  z-index: 5;
}

/* Container-Scoped Toast Stack */
.sl-toast-stack,
.copio-toast-stack-scoped {
  position: absolute !important;
  top: auto !important;
  bottom: 0 !important;
  left: 0 !important;
  right: 0 !important;
  width: 100% !important;
  max-width: 100% !important;
  padding: var(--copio-spacing-md) !important;
  box-sizing: border-box !important;
  z-index: 1000 !important;
  pointer-events: none;
}

.sl-toast-stack sl-alert,
.copio-toast-stack-scoped sl-alert {
  pointer-events: auto;
  margin-top: var(--copio-spacing-sm);
}

/* ==========================================================================
   4. @container BREAKPOINTS (Strictly Container Queries)
   ========================================================================== */

/* Modal Breakpoint: <= 400px */
@container copio-scanner (max-width: 400px) {
  .copio-header {
    padding: var(--copio-spacing-xs) var(--copio-spacing-sm);
    min-height: 48px;
  }
  .copio-subtitle {
    display: none;
  }
  .copio-btn {
    padding: 0 8px;
    font-size: 12px;
  }
}

/* Drawer Breakpoint: 401px..767px */
@container copio-scanner (min-width: 401px) and (max-width: 767px) {
  .copio-header {
    padding: var(--copio-spacing-sm) var(--copio-spacing-md);
  }
}

/* Full View Breakpoint: >= 768px */
@container copio-scanner (min-width: 768px) {
  .copio-header {
    padding: var(--copio-spacing-md) var(--copio-spacing-lg);
  }
}
`;

let cachedScannerSheet = null;

/**
 * Returns a cached constructable CSSStyleSheet instance for <copio-scanner>.
 * Returns null if constructable stylesheets are not supported.
 * @returns {CSSStyleSheet|null}
 */
export function getScannerStyleSheet() {
  if (cachedScannerSheet) {
    return cachedScannerSheet;
  }
  if (
    typeof CSSStyleSheet !== 'undefined' &&
    typeof Document !== 'undefined' &&
    'adoptedStyleSheets' in Document.prototype &&
    'replaceSync' in CSSStyleSheet.prototype
  ) {
    try {
      cachedScannerSheet = new CSSStyleSheet();
      cachedScannerSheet.replaceSync(scannerCss);
      return cachedScannerSheet;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Adopts the encapsulated <copio-scanner> stylesheet into a ShadowRoot.
 * Uses adoptedStyleSheets when supported, falling back to a scoped <style> element.
 * 
 * @param {ShadowRoot} shadowRoot
 * @returns {void}
 */
export function adoptScannerStyles(shadowRoot) {
  if (!shadowRoot) return;

  const sheet = getScannerStyleSheet();
  if (sheet && 'adoptedStyleSheets' in shadowRoot) {
    const current = shadowRoot.adoptedStyleSheets || [];
    if (!current.includes(sheet)) {
      shadowRoot.adoptedStyleSheets = [...current, sheet];
    }
  } else {
    // Fallback: inject scoped <style> element if not already present
    if (!shadowRoot.querySelector('style[data-copio-encapsulated-styles]')) {
      const styleEl = document.createElement('style');
      styleEl.setAttribute('data-copio-encapsulated-styles', '');
      styleEl.textContent = scannerCss;
      shadowRoot.appendChild(styleEl);
    }
  }
}
