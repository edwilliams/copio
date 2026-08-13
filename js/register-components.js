import './copio-app.js';
import './copio-loader.js';
import './copio-header.js';
import './copio-row.js';
import './copio-images.js';
import './copio-carousel.js';

// =============================================
// Show UI when custom components are ready
// note: might not be great loading this before app.js
// =============================================

// trick borrow from shoelace; prevents flash of unstyled content
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
  customElements.whenDefined('copio-app'),
  customElements.whenDefined('copio-loader'),
  customElements.whenDefined('copio-header'),
  customElements.whenDefined('copio-row'),
  customElements.whenDefined('copio-images'),
  customElements.whenDefined('copio-carousel'),
]);

document.body.classList.add('ready');
