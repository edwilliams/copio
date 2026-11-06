// SPDX-License-Identifier: AGPL-3.0
import '../routes/ocr/copio-doc-ocr-dialog.js';
import '../routes/sync/copio-sync-dialog.js';

// =============================================
// Show UI when custom components are ready
// =============================================

await Promise.allSettled([
  // shoelace
  customElements.whenDefined('sl-button'),
  customElements.whenDefined('sl-icon'),
  customElements.whenDefined('sl-input'),
  customElements.whenDefined('sl-dialog'),
  customElements.whenDefined('sl-menu'),
  customElements.whenDefined('sl-menu-item'),
  customElements.whenDefined('sl-dropdown'),
  customElements.whenDefined('sl-icon-button'),
  customElements.whenDefined('sl-alert'),
  customElements.whenDefined('sl-avatar'),
  customElements.whenDefined('sl-carousel'),
  customElements.whenDefined('sl-carousel-item'),
  customElements.whenDefined('sl-divider'),
  customElements.whenDefined('sl-spinner'),
  customElements.whenDefined('sl-textarea'),
  customElements.whenDefined('sl-progress-bar'),
  customElements.whenDefined('sl-badge'),
  customElements.whenDefined('sl-select'),
  customElements.whenDefined('sl-option'),
  customElements.whenDefined('sl-copy-button'),
  customElements.whenDefined('sl-tooltip'),
  customElements.whenDefined('sl-tab-group'),
  customElements.whenDefined('sl-tab'),
  customElements.whenDefined('sl-tab-panel'),
  // copio
  customElements.whenDefined('copio-doc-ocr-dialog'),
  customElements.whenDefined('copio-sync-dialog'),
]);

document.body.classList.add('ready');
