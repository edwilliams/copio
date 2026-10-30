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

/* Interactive Stage Switcher Pill (Viewfinder vs Workbench) */
.copio-stage-tabs {
  display: inline-flex;
  background: var(--copio-color-bg);
  padding: 2px;
  border-radius: var(--copio-radius-md);
  border: 1px solid var(--copio-color-border);
}

.copio-stage-tab {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--copio-color-text-muted);
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  padding: 6px 10px;
  min-height: var(--copio-touch-target-min);
  min-width: var(--copio-touch-target-min);
  border-radius: var(--copio-radius-sm);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background var(--copio-transition-fast), color var(--copio-transition-fast);
}

.copio-stage-tab[aria-selected="true"] {
  background: var(--copio-color-surface-elevated);
  color: var(--copio-color-text);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
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
.copio-viewfinder,
.copio-viewfinder-stage {
  position: relative;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background: var(--copio-color-stage-bg);
  overflow: hidden;
  min-height: 0;
  width: 100%;
}

.copio-viewfinder-feed,
.copio-camera-feed {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 56px 20px 104px 20px;
  background: radial-gradient(circle at 50% 45%, #1e293b 0%, #090d14 75%);
}

/* Framing Guide Overlay (receipt | card | a4 | auto) */
.copio-framing-guide {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: 100%;
  max-height: 100%;
  border: 1.5px dashed rgba(56, 189, 248, 0.55);
  border-radius: 12px;
  box-shadow: 0 0 0 9999px rgba(4, 7, 12, 0.52);
  transition: all var(--copio-transition-normal);
  overflow: hidden;
}

.copio-framing-guide[data-aspect="receipt"] {
  aspect-ratio: 1 / 2.1;
  height: 100%;
}

.copio-framing-guide[data-aspect="card"] {
  aspect-ratio: 1.586 / 1;
  width: 92%;
  max-height: 82%;
}

.copio-framing-guide[data-aspect="a4"] {
  aspect-ratio: 1 / 1.414;
  height: 96%;
}

.copio-framing-guide[data-aspect="auto"] {
  width: 94%;
  height: 94%;
}

/* Corner Targeting Brackets */
.copio-corner {
  position: absolute;
  width: 22px;
  height: 22px;
  border-color: var(--copio-color-primary);
  border-style: solid;
  border-width: 0;
  pointer-events: none;
  z-index: 2;
}
.copio-corner.tl { top: 6px; left: 6px; border-top-width: 3px; border-left-width: 3px; border-top-left-radius: 6px; }
.copio-corner.tr { top: 6px; right: 6px; border-top-width: 3px; border-right-width: 3px; border-top-right-radius: 6px; }
.copio-corner.bl { bottom: 6px; left: 6px; border-bottom-width: 3px; border-left-width: 3px; border-bottom-left-radius: 6px; }
.copio-corner.br { bottom: 6px; right: 6px; border-bottom-width: 3px; border-right-width: 3px; border-bottom-right-radius: 6px; }

/* Top Viewfinder HUD Overlay (Step Pill + Privacy Assurance Badge) */
.copio-viewfinder-hud-top {
  position: relative;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px;
  background: linear-gradient(to bottom, rgba(7, 10, 15, 0.85), transparent);
}

.copio-step-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: var(--copio-radius-pill);
  background: rgba(15, 23, 42, 0.88);
  border: 1px solid rgba(56, 189, 248, 0.45);
  color: #f8fafc;
  font-size: 12px;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
}

.copio-privacy-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 9px;
  border-radius: var(--copio-radius-pill);
  background: rgba(22, 101, 52, 0.35);
  border: 1px solid rgba(34, 197, 94, 0.4);
  color: #86efac;
  font-size: 11px;
  font-weight: 500;
}

/* Shutter Dock (Shadow Part: shutter-dock) */
.copio-shutter-dock {
  position: relative;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  background: var(--copio-color-surface);
  border-top: 1px solid var(--copio-color-border);
  min-height: 84px;
  flex-shrink: 0;
}

.copio-shutter-side {
  flex: 1;
  display: flex;
  align-items: center;
}

.copio-shutter-side.right {
  justify-content: flex-end;
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
  transition: transform var(--copio-transition-fast), border-color 150ms ease;
  flex-shrink: 0;
}

.copio-shutter-btn:hover {
  transform: scale(1.04);
}

.copio-shutter-btn:active {
  transform: scale(0.94);
}

.copio-shutter-btn-inner,
.copio-shutter-inner {
  width: 100%;
  height: 100%;
  border-radius: var(--copio-radius-pill);
  background: var(--copio-color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--copio-color-primary-contrast);
  transition: transform var(--copio-transition-fast);
}

.copio-shutter-btn:active .copio-shutter-btn-inner,
.copio-shutter-btn:active .copio-shutter-inner {
  transform: scale(0.88);
}

/* Stacking Thumbnail Counter Pill in Viewfinder */
.copio-stack-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: var(--copio-touch-target-min);
  padding: 4px 12px 4px 6px;
  border-radius: var(--copio-radius-md);
  background: var(--copio-color-surface-elevated);
  border: 1px solid var(--copio-color-primary);
  color: var(--copio-color-text);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.copio-stack-thumb {
  width: 30px;
  height: 36px;
  border-radius: 4px;
  object-fit: cover;
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: #000;
}

/* Workbench & Filmstrip (Shadow Part: workbench) */
.copio-workbench,
.copio-workbench-stage {
  position: relative;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  background: var(--copio-color-bg);
  overflow: hidden;
  min-height: 0;
  width: 100%;
}

.copio-workbench-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  width: 100%;
  overflow: hidden;
}

.copio-stage-canvas,
.copio-canvas-viewport {
  position: relative;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 16px 20px 44px 20px;
  background: var(--copio-color-stage-bg);
  min-height: 180px;
}

.copio-canvas-viewport.has-card-switcher {
  padding-top: 66px;
}

.copio-canvas-viewport.is-cropping {
  padding: 74px 26px 26px 26px;
}

/* Card Side Switcher */
.copio-card-side-switcher {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 6;
  display: inline-flex;
  gap: 4px;
  padding: 3px;
  background: var(--copio-color-surface-overlay, rgba(15, 22, 32, 0.88));
  border: 1px solid var(--copio-color-border-strong);
  border-radius: var(--copio-radius-pill);
  backdrop-filter: blur(8px);
}

.copio-side-pill {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--copio-color-text-muted);
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  padding: 6px 12px;
  min-height: var(--copio-touch-target-min);
  min-width: var(--copio-touch-target-min);
  border-radius: var(--copio-radius-pill);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.copio-side-pill[aria-selected="true"] {
  background: var(--copio-color-primary);
  color: var(--copio-color-primary-contrast);
}

.copio-stage-figure {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: 100%;
  max-height: 100%;
}

.copio-stage-canvas img,
.copio-stage-img {
  display: block;
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
  box-shadow: var(--copio-shadow-elevated);
  border-radius: var(--copio-radius-sm);
  user-select: none;
}

.copio-edit-state-bar {
  position: absolute;
  bottom: 10px;
  left: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  pointer-events: none;
  z-index: 5;
}

.copio-status-chip {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: var(--copio-radius-pill);
  background: rgba(15, 23, 42, 0.85);
  border: 1px solid rgba(148, 163, 184, 0.25);
  color: #e2e8f0;
  font-size: 11px;
  font-weight: 500;
  backdrop-filter: blur(6px);
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

.copio-crop-banner-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

/* Filmstrip & Reorder Tray */
.copio-filmstrip,
.copio-filmstrip-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--copio-color-surface);
  border-top: 1px solid var(--copio-color-border);
  overflow-x: auto;
  min-height: 80px;
  flex-shrink: 0;
}

.copio-thumb-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 60px;
  flex-shrink: 0;
  padding: 4px;
  border-radius: var(--copio-radius-sm);
  background: var(--copio-color-surface-elevated);
  border: 2px solid transparent;
  cursor: pointer;
  transition: all var(--copio-transition-fast);
}

.copio-thumb-card[aria-selected="true"] {
  border-color: var(--copio-color-primary);
  background: rgba(56, 189, 248, 0.12);
}

.copio-thumb-card.dragging {
  opacity: 0.4;
  transform: scale(0.95);
}

.copio-thumb-img-wrap {
  width: 48px;
  height: 60px;
  border-radius: 4px;
  overflow: hidden;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.copio-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.copio-thumb-meta {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  margin-top: 4px;
  font-size: 10px;
  font-weight: 600;
  color: var(--copio-color-text-muted);
}

.copio-filmstrip-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  margin-left: auto;
}

.copio-add-page-tile {
  min-width: 60px;
  height: 82px;
  padding: 0 8px;
  flex-shrink: 0;
  border-radius: var(--copio-radius-sm);
  border: 1.5px dashed var(--copio-color-border-strong);
  background: transparent;
  color: var(--copio-color-text-muted);
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  transition: all var(--copio-transition-fast);
}

.copio-add-page-tile:hover {
  border-color: var(--copio-color-primary);
  color: var(--copio-color-primary);
  background: rgba(56, 189, 248, 0.06);
}

/* Edit Action Toolbar & Primary Completion Dock */
.copio-toolbar,
.copio-controls-dock {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  background: var(--copio-color-surface);
  border-top: 1px solid var(--copio-color-border);
  min-height: 56px;
  flex-shrink: 0;
  z-index: 6;
}

.copio-edit-toolbar {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  width: 100%;
}

.copio-edit-toolbar.cols-5 {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.copio-tool-btn {
  appearance: none;
  border: 1px solid var(--copio-color-border);
  background: var(--copio-color-surface-elevated);
  color: var(--copio-color-text);
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  min-height: var(--copio-touch-target-min);
  min-width: var(--copio-touch-target-min);
  padding: 4px 6px;
  border-radius: var(--copio-radius-md);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  cursor: pointer;
  transition: all var(--copio-transition-fast);
}

.copio-tool-btn:hover:not(:disabled) {
  border-color: var(--copio-color-border-strong);
  background: rgba(255, 255, 255, 0.06);
}

.copio-tool-btn[aria-pressed="true"] {
  background: rgba(56, 189, 248, 0.16);
  color: var(--copio-color-primary);
  border-color: var(--copio-color-primary);
}

.copio-tool-btn.danger {
  color: #fca5a5;
}

.copio-tool-btn.danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.16);
  border-color: rgba(239, 68, 68, 0.45);
}

.copio-submit-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.copio-submit-btn {
  flex: 1;
  min-height: 46px;
  font-size: 14px;
}

/* Container-Scoped Toast & Undo Notification */
.copio-toast-region {
  position: absolute;
  bottom: 124px;
  left: 12px;
  right: 12px;
  z-index: 30;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.copio-toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 12px;
  border-radius: var(--copio-radius-md);
  background: #0f172a;
  color: #f8fafc;
  border: 1px solid var(--copio-color-primary);
  box-shadow: var(--copio-shadow-elevated);
  font-size: 12px;
  font-weight: 500;
  position: relative;
  overflow: hidden;
}

.copio-toast-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 3px;
  background: var(--copio-color-primary);
  transition: width 100ms linear;
}

.copio-toast-undo-btn {
  appearance: none;
  border: 1px solid rgba(56, 189, 248, 0.45);
  background: rgba(56, 189, 248, 0.16);
  color: #38bdf8;
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  min-height: var(--copio-touch-target-min);
  min-width: var(--copio-touch-target-min);
  padding: 0 12px;
  border-radius: var(--copio-radius-sm);
  cursor: pointer;
  flex-shrink: 0;
}

/* Slide-up OCR Extraction Sheet */
.copio-ocr-sheet {
  position: absolute;
  inset: auto 0 0 0;
  max-height: 78%;
  background: var(--copio-color-surface);
  border-top: 1px solid var(--copio-color-primary);
  border-radius: 16px 16px 0 0;
  box-shadow: 0 -16px 40px rgba(0, 0, 0, 0.65);
  z-index: 25;
  display: flex;
  flex-direction: column;
  padding: 14px;
  gap: 10px;
}

.copio-ocr-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.copio-ocr-textarea {
  width: 100%;
  min-height: 130px;
  flex: 1;
  resize: none;
  background: var(--copio-color-bg);
  color: var(--copio-color-text);
  border: 1px solid var(--copio-color-border);
  border-radius: var(--copio-radius-sm);
  padding: 10px;
  font-family: var(--copio-font-mono);
  font-size: 11px;
  line-height: 1.5;
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
    padding: 6px 10px;
    min-height: 52px;
  }
  .copio-header-left {
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }
  .copio-mode-badge {
    font-size: 10px;
    padding: 2px 6px;
  }
  .copio-subtitle {
    display: none;
  }
  .copio-privacy-pill span.hide-compact {
    display: none;
  }
  .copio-crop-banner-text {
    display: none;
  }
  .copio-crop-banner-actions {
    width: 100%;
    justify-content: space-between;
  }
  .copio-filmstrip-bar {
    gap: 6px;
    padding: 6px 8px;
  }
  .copio-thumb-card {
    width: 52px;
    padding: 3px;
  }
  .copio-thumb-img-wrap {
    width: 42px;
    height: 52px;
  }
  .copio-filmstrip-actions {
    gap: 4px;
  }
  .copio-add-page-tile {
    min-width: 52px;
    height: 70px;
    padding: 0 6px;
    font-size: 10px;
  }
  .copio-tool-btn {
    font-size: 10px;
    padding: 3px 4px;
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
  .copio-tool-btn {
    flex-direction: row;
    font-size: 12px;
    gap: 6px;
  }
}

/* Full View Breakpoint: >= 768px */
@container copio-scanner (min-width: 768px) {
  .copio-header {
    padding: var(--copio-spacing-md) var(--copio-spacing-lg);
  }
  .copio-workbench-main {
    flex-direction: row;
  }
  .copio-filmstrip-bar {
    order: -1;
    flex-direction: column;
    width: 168px;
    height: 100%;
    border-top: none;
    border-right: 1px solid var(--copio-color-border);
    overflow-y: auto;
    overflow-x: hidden;
    padding: 12px;
  }
  .copio-thumb-card {
    width: 100%;
    padding: 8px;
  }
  .copio-thumb-img-wrap {
    width: 100%;
    height: 110px;
  }
  .copio-filmstrip-actions {
    width: 100%;
    flex-wrap: wrap;
    justify-content: center;
    margin-left: 0;
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
