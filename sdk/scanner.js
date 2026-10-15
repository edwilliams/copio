/**
 * Copio Scanner Web Components (CPO-034, CPO-061)
 */
import { CopioImages } from '../js/routes/doc/copio-images.js';
import { CopioCarousel } from '../js/routes/doc/copio-carousel.js';
import { CopioAddEditDialog } from '../js/routes/add-edit/copio-add-edit-dialog.js';
import { CopioRow } from '../js/routes/home/copio-row.js';
import { CopioHeader } from '../js/components/copio-header.js';
import { CopioLoader } from '../js/components/copio-loader.js';

const BaseElement = typeof HTMLElement !== 'undefined' ? HTMLElement : class {};

/**
 * <copio-scanner> Web Component Driving UI Adapter
 */
export class CopioScanner extends BaseElement {
  static get observedAttributes() {
    return ['mode', 'doc-id'];
  }

  constructor() {
    super();
    if (typeof this.attachShadow === 'function') {
      this.attachShadow({ mode: 'open' });
    }
  }

  connectedCallback() {
    if (this.shadowRoot && !this.shadowRoot.innerHTML) {
      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: block;
            position: relative;
            width: 100%;
            min-height: 200px;
            font-family: inherit;
          }
        </style>
        <div class="copio-scanner-container">
          <slot></slot>
        </div>
      `;
    }
  }

  get mode() {
    return typeof this.getAttribute === 'function' ? (this.getAttribute('mode') || 'document') : 'document';
  }

  set mode(val) {
    if (typeof this.setAttribute === 'function') {
      this.setAttribute('mode', val);
    }
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('copio-scanner')) {
  customElements.define('copio-scanner', CopioScanner);
}

export {
  CopioImages,
  CopioCarousel,
  CopioAddEditDialog,
  CopioRow,
  CopioHeader,
  CopioLoader,
};
