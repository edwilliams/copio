// @ts-nocheck
import { LitElement, html, css } from '../../lib/lit-core.min.js';

export class CopioCarousel extends LitElement {
  disconnectedCallback() {
    super.disconnectedCallback();
    this.activeSlideIndex = 0;
  }

  static properties = {
    docId: { type: String },
    docName: { type: String },
    images: { type: Array },
    activeSlideIndex: { type: Number, state: true },
    ocr: { type: Boolean },
    pdf: { type: Boolean },
  };

  get visibleImages() {
    return this.images || [];
  }

  get hasImages() {
    return (this.images || []).some((img) => !!img.src);
  }

  get pageCount() {
    return this.visibleImages.length;
  }

  static styles = css`
    :host {
      display: block;
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100%;
      height: 100%;
      z-index: 10;
      overflow: hidden;
      background: #000;
      box-sizing: border-box;
    }
    sl-carousel {
      position: absolute;
      top: 0;
      padding-top: 16px;
      background: white;
      z-index: 4;
      height: 100%;
      width: 100%;
    }
    sl-carousel-item {
      height: 100%;
    }
    .item {
      width: 100%;
      height: 100%;
      background-repeat: no-repeat;
      background-size: contain;
      background-position: center;
    }
    .top-bar {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 56px;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      background: linear-gradient(to bottom, rgba(15, 23, 42, 0.85) 0%, rgba(15, 23, 42, 0.3) 80%, transparent 100%);
      pointer-events: none;
      box-sizing: border-box;
    }
    .top-bar > * {
      pointer-events: auto;
    }
    .top-bar-left {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    .top-bar-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .back {
      font-size: 26px;
      cursor: pointer;
      appearance: none;
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      color: white;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s;
    }
    .back:hover {
      background: rgba(15, 23, 42, 0.9);
    }
    .doc-heading {
      color: #f8fafc;
      font-size: 1.05rem;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 240px;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
    }
    .ocr-btn, .export-btn {
      background: rgba(15, 23, 42, 0.75);
      backdrop-filter: blur(8px);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      padding: 6px 12px;
      height: 36px;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
      box-sizing: border-box;
    }
    .ocr-btn:hover, .export-btn:hover {
      background: rgba(15, 23, 42, 0.95);
      border-color: rgba(255, 255, 255, 0.4);
    }
  `;

  constructor() {
    super();
    this.docId = '';
    this.docName = '';
    this.images = [];
    this.activeSlideIndex = 0;
    this.ocr = true;
    this.pdf = true;
  }

  handleBackClick() {
    this.dispatchEvent(new CustomEvent('dialog:close', { bubbles: true, composed: false }));
  }

  handleOcrClick() {
    const activePage = this.images[this.activeSlideIndex];
    if (!activePage || !activePage.src) return;

    this.dispatchEvent(
      new CustomEvent('copio:ocr-page', {
        bubbles: true,
        composed: true,
        detail: {
          page: activePage,
          pageIndex: this.activeSlideIndex,
        },
      }),
    );
  }

  handleExportSelect(e) {
    if (e.detail?.item?.disabled) return;
    const value = e.detail?.item?.value;
    const detail = {
      docId: this.docId,
      docName: this.docName,
      pages: this.images,
    };

    if (value === 'pdf') {
      this.dispatchEvent(new CustomEvent('doc:download-pdf', { bubbles: true, composed: false, detail: { ...detail, searchable: false } }));
    } else if (value === 'searchable-pdf') {
      this.dispatchEvent(new CustomEvent('doc:download-pdf', { bubbles: true, composed: false, detail: { ...detail, searchable: true } }));
    } else if (value === 'images') {
      this.dispatchEvent(new CustomEvent('doc:download-images', { bubbles: true, composed: false, detail }));
    }
  }

  handleSlideChange(e) {
    this.activeSlideIndex = e.detail?.index || 0;
  }

  renderItem(img) {
    return html`
      <sl-carousel-item data-id="${img.id}">
        <div class="item" style="background-image: url('${img.src}')"></div>
      </sl-carousel-item>
    `;
  }

  render() {
    const activePage = this.visibleImages[this.activeSlideIndex];
    const canOcr = this.ocr !== false && activePage && !!activePage.src;

    return html`
      <div class="top-bar">
        <div class="top-bar-left">
          <button class="back" @click=${this.handleBackClick} aria-label="Back">←</button>
          <span class="doc-heading">${this.docName || 'Document'}</span>
        </div>

        <div class="top-bar-right">
          ${canOcr
            ? html`
                <button class="ocr-btn" @click=${this.handleOcrClick} aria-label="Extract text">
                  <sl-icon name="card-text"></sl-icon>
                  <span>Extract Text</span>
                </button>
              `
            : ''}

          <sl-dropdown>
            <button slot="trigger" class="export-btn" aria-label="Export document">
              <sl-icon name="box-arrow-up"></sl-icon>
              <span>Export</span>
              <sl-icon name="chevron-down" style="font-size: 0.75rem;"></sl-icon>
            </button>
            <sl-menu @sl-select=${this.handleExportSelect}>
              ${this.pdf !== false
                ? html`
                    <sl-menu-item value="pdf" ?disabled=${this.pageCount === 0}>
                      <sl-icon slot="prefix" name="file-earmark-pdf"></sl-icon>
                      Download as PDF
                    </sl-menu-item>
                    ${this.ocr !== false
                      ? html`
                          <sl-menu-item value="searchable-pdf" ?disabled=${this.pageCount === 0}>
                            <sl-icon slot="prefix" name="file-earmark-text"></sl-icon>
                            Download Searchable PDF
                          </sl-menu-item>
                        `
                      : ''}
                  `
                : ''}
              <sl-menu-item value="images" ?disabled=${this.pageCount === 0}>
                <sl-icon slot="prefix" name="images"></sl-icon>
                Download as Images (ZIP)
              </sl-menu-item>
            </sl-menu>
          </sl-dropdown>
        </div>
      </div>

      <sl-carousel
        class="sl-carousel"
        orientation="vertical"
        @sl-slide-change=${this.handleSlideChange}
      >
        ${this.visibleImages.map((img) => this.renderItem(img))}
      </sl-carousel>
    `;
  }
}

customElements.define('copio-carousel', CopioCarousel);
