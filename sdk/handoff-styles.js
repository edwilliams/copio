// SPDX-License-Identifier: AGPL-3.0
/**
 * Copio Handoff Encapsulated Styles & Design Tokens (CPO-091)
 *
 * Provides constructable stylesheets and adoptedStyleSheets architecture for <copio-handoff>
 * with complete Shadow DOM style encapsulation, zero global leakage, and container query support.
 */

export const handoffCss = `
:host {
  all: initial;
  display: block;
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 280px;
  box-sizing: border-box;
  container-type: inline-size;
  container-name: copio-handoff;
  overflow-y: auto;
  overflow-x: hidden;
  text-align: left;
  direction: ltr;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;

  --copio-font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --copio-font-mono: 'JetBrains Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
  --copio-color-bg: #0b0f17;
  --copio-color-surface: #131b26;
  --copio-color-surface-elevated: #1c2736;
  --copio-color-surface-overlay: rgba(15, 22, 32, 0.88);
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
  --copio-radius-pill: 9999px;
  --copio-spacing-xs: 4px;
  --copio-spacing-sm: 8px;
  --copio-spacing-md: 12px;
  --copio-spacing-lg: 16px;
  --copio-spacing-xl: 24px;
  --copio-touch-target-min: 44px;
  --copio-shadow-elevated: 0 12px 32px -4px rgba(0, 0, 0, 0.55);
  --copio-transition-fast: 150ms cubic-bezier(0.22, 1, 0.36, 1);
  --copio-transition-normal: 240ms cubic-bezier(0.22, 1, 0.36, 1);

  font-family: var(--copio-font-family);
  font-size: 14px;
  line-height: 1.5;
  color: var(--copio-color-text);
  background-color: var(--copio-color-bg);
  color-scheme: dark;
}

:host([theme="light"]),
:host(.copio-theme-light),
:host-context([data-theme="light"]),
:host-context(.sl-theme-light),
:host-context(.theme-light) {
  --copio-color-bg: #f8fafc;
  --copio-color-surface: #ffffff;
  --copio-color-surface-elevated: #f1f5f9;
  --copio-color-surface-overlay: rgba(255, 255, 255, 0.92);
  --copio-color-text: #0f172a;
  --copio-color-text-muted: #64748b;
  --copio-color-text-inverse: #ffffff;
  --copio-color-border: rgba(15, 23, 42, 0.12);
  --copio-color-border-strong: rgba(15, 23, 42, 0.24);
  --copio-color-primary: #0284c7;
  --copio-color-primary-hover: #0369a1;
  --copio-color-primary-contrast: #ffffff;
  --copio-shadow-elevated: 0 12px 28px -4px rgba(15, 23, 42, 0.12);
  color-scheme: light;
}

*, *::before, *::after {
  box-sizing: border-box;
}

.copio-handoff-root {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 100%;
  padding: var(--copio-spacing-xl);
  background-color: var(--copio-color-bg);
  color: var(--copio-color-text);
  text-align: center;
}

/* Card Container */
.copio-handoff-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 440px;
  background-color: var(--copio-color-surface);
  border: 1px solid var(--copio-color-border);
  border-radius: var(--copio-radius-lg);
  padding: var(--copio-spacing-xl);
  box-shadow: var(--copio-shadow-elevated);
  transition: transform var(--copio-transition-fast), border-color var(--copio-transition-fast);
}

/* Typography */
.copio-handoff-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 var(--copio-spacing-xs);
  color: var(--copio-color-text);
}

.copio-handoff-desc {
  font-size: 13px;
  color: var(--copio-color-text-muted);
  margin: 0 0 var(--copio-spacing-lg);
  max-width: 320px;
  line-height: 1.4;
}

/* QR Code Box */
.copio-handoff-qr-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 220px;
  height: 220px;
  background-color: #ffffff;
  border-radius: var(--copio-radius-md);
  padding: var(--copio-spacing-md);
  margin-bottom: var(--copio-spacing-md);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  position: relative;
  overflow: hidden;
}

.copio-handoff-qr-box svg {
  width: 100%;
  height: 100%;
  display: block;
}

.copio-handoff-qr-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--copio-spacing-sm);
  color: #64748b;
  font-size: 12px;
}

/* Timer and Refresh Meta */
.copio-handoff-meta-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--copio-spacing-sm);
  margin-bottom: var(--copio-spacing-lg);
  font-size: 12px;
  color: var(--copio-color-text-muted);
}

.copio-handoff-timer-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background-color: var(--copio-color-surface-elevated);
  border: 1px solid var(--copio-color-border);
  padding: 4px 10px;
  border-radius: var(--copio-radius-pill);
  font-family: var(--copio-font-mono);
  font-weight: 500;
}

.copio-handoff-icon-btn {
  background: transparent;
  border: none;
  color: var(--copio-color-text-muted);
  cursor: pointer;
  padding: 6px;
  border-radius: var(--copio-radius-pill);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: color var(--copio-transition-fast), background-color var(--copio-transition-fast);
}

.copio-handoff-icon-btn:hover {
  color: var(--copio-color-primary);
  background-color: var(--copio-color-surface-elevated);
}

/* Divider */
.copio-handoff-divider {
  display: flex;
  align-items: center;
  width: 100%;
  margin: var(--copio-spacing-sm) 0 var(--copio-spacing-md);
  color: var(--copio-color-text-muted);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.copio-handoff-divider::before,
.copio-handoff-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background-color: var(--copio-color-border);
}

.copio-handoff-divider span {
  padding: 0 var(--copio-spacing-sm);
}

/* Buttons */
.copio-handoff-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--copio-spacing-sm);
  width: 100%;
  min-height: var(--copio-touch-target-min);
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 500;
  border-radius: var(--copio-radius-md);
  cursor: pointer;
  border: 1px solid transparent;
  transition: background-color var(--copio-transition-fast), border-color var(--copio-transition-fast), color var(--copio-transition-fast);
}

.copio-handoff-btn-secondary {
  background-color: var(--copio-color-surface-elevated);
  border-color: var(--copio-color-border);
  color: var(--copio-color-text);
}

.copio-handoff-btn-secondary:hover {
  border-color: var(--copio-color-border-strong);
  color: var(--copio-color-primary);
  background-color: var(--copio-color-surface);
}

.copio-handoff-btn-primary {
  background-color: var(--copio-color-primary);
  color: var(--copio-color-primary-contrast);
  font-weight: 600;
}

.copio-handoff-btn-primary:hover {
  background-color: var(--copio-color-primary-hover);
}

/* Status Indicators */
.copio-handoff-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: var(--copio-radius-pill);
  font-size: 13px;
  font-weight: 500;
  margin-bottom: var(--copio-spacing-md);
  border: 1px solid var(--copio-color-border);
  background-color: var(--copio-color-surface-elevated);
}

.copio-handoff-pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--copio-color-success);
  box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
  animation: copio-handoff-pulse 2s infinite;
}

@keyframes copio-handoff-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
  }
  70% {
    box-shadow: 0 0 0 8px rgba(34, 197, 94, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
  }
}

.copio-handoff-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  border-radius: var(--copio-radius-pill);
  background-color: var(--copio-color-surface-elevated);
  border: 1px solid var(--copio-color-border);
  font-size: 12px;
  color: var(--copio-color-text-muted);
  font-weight: 500;
  margin-bottom: var(--copio-spacing-lg);
}

/* Progress Bar (Receiving State) */
.copio-handoff-progress-wrap {
  width: 100%;
  margin-bottom: var(--copio-spacing-lg);
}

.copio-handoff-progress-bar {
  width: 100%;
  height: 8px;
  background-color: var(--copio-color-surface-elevated);
  border-radius: var(--copio-radius-pill);
  overflow: hidden;
  border: 1px solid var(--copio-color-border);
}

.copio-handoff-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--copio-color-primary) 0%, #38bdf8 100%);
  border-radius: var(--copio-radius-pill);
  transition: width 150ms ease-out;
}

.copio-handoff-progress-label {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--copio-color-text-muted);
  margin-top: 6px;
}

/* Thumbnail Grid */
.copio-handoff-thumbnails {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: var(--copio-spacing-sm);
  width: 100%;
  max-height: 240px;
  overflow-y: auto;
  padding: 4px;
  margin-bottom: var(--copio-spacing-lg);
}

.copio-handoff-thumb-card {
  position: relative;
  aspect-ratio: 3 / 4;
  background-color: var(--copio-color-surface-elevated);
  border: 1px solid var(--copio-color-border);
  border-radius: var(--copio-radius-sm);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.copio-handoff-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.copio-handoff-thumb-label {
  position: absolute;
  bottom: 4px;
  right: 4px;
  background-color: rgba(0, 0, 0, 0.7);
  color: #ffffff;
  font-size: 10px;
  padding: 2px 5px;
  border-radius: 4px;
  font-family: var(--copio-font-mono);
}

.copio-handoff-thumb-shimmer {
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, var(--copio-color-surface-elevated) 0%, rgba(56, 189, 248, 0.15) 50%, var(--copio-color-surface-elevated) 100%);
  background-size: 200% 100%;
  animation: copio-shimmer 1.5s infinite;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--copio-color-primary);
}

@keyframes copio-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* Complete State */
.copio-handoff-success-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: rgba(34, 197, 94, 0.15);
  color: var(--copio-color-success);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--copio-spacing-md);
}

/* Error / Expired State */
.copio-handoff-alert {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  margin-bottom: var(--copio-spacing-lg);
}

.copio-handoff-alert-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--copio-spacing-md);
}

.copio-handoff-alert-icon.warning {
  background-color: rgba(245, 158, 11, 0.15);
  color: var(--copio-color-warning);
}

.copio-handoff-alert-icon.danger {
  background-color: rgba(239, 68, 68, 0.15);
  color: var(--copio-color-danger);
}

/* Spinner */
.copio-handoff-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(148, 163, 184, 0.2);
  border-top-color: var(--copio-color-primary);
  border-radius: 50%;
  animation: copio-spin 0.8s linear infinite;
}

@keyframes copio-spin {
  to { transform: rotate(360deg); }
}

/* Responsive Container Queries */
@container copio-handoff (max-width: 400px) {
  .copio-handoff-root {
    padding: var(--copio-spacing-md);
  }
  .copio-handoff-card {
    padding: var(--copio-spacing-md);
  }
  .copio-handoff-qr-box {
    width: 170px;
    height: 170px;
  }
  .copio-handoff-title {
    font-size: 16px;
  }
  .copio-handoff-desc {
    font-size: 12px;
  }
}

@container copio-handoff (min-width: 600px) {
  .copio-handoff-card {
    max-width: 520px;
  }
  .copio-handoff-qr-box {
    width: 240px;
    height: 240px;
  }
}
`;

/** @type {CSSStyleSheet|null} */
let handoffStyleSheet = null;

export function getHandoffStyleSheet() {
  if (typeof CSSStyleSheet === 'undefined') return null;
  if (!handoffStyleSheet) {
    try {
      handoffStyleSheet = new CSSStyleSheet();
      handoffStyleSheet.replaceSync(handoffCss);
    } catch {
      handoffStyleSheet = null;
    }
  }
  return handoffStyleSheet;
}

export function adoptHandoffStyles(shadowRoot) {
  if (!shadowRoot) return;

  const sheet = getHandoffStyleSheet();
  if (sheet && 'adoptedStyleSheets' in shadowRoot) {
    const current = shadowRoot.adoptedStyleSheets || [];
    if (!current.includes(sheet)) {
      shadowRoot.adoptedStyleSheets = [...current, sheet];
    }
  } else {
    if (!shadowRoot.querySelector('style[data-copio-handoff-styles]')) {
      const styleEl = document.createElement('style');
      styleEl.setAttribute('data-copio-handoff-styles', '');
      styleEl.textContent = handoffCss;
      shadowRoot.appendChild(styleEl);
    }
  }
}
