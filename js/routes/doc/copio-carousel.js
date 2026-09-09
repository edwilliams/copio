import { LitElement, html, css } from '../../lib/lit-core.min.js';
import { recognizeImageText, SUPPORTED_LANGUAGES } from '../../services/ocr-service.js';

class CopioCarousel extends LitElement {
  static properties = {
    images: { type: Array },
    activeSlideIndex: { type: Number, state: true },
    ocrState: { type: Object, state: true },
  };

  static styles = css`
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
    .back {
      position: absolute;
      top: 0;
      left: 0;
      z-index: 5;
      padding: 8px 32px;
      font-size: 48px;
      cursor: pointer;
      appearance: none;
      background: none;
      border: none;
    }
    .carousel-top-actions {
      position: absolute;
      top: 16px;
      right: 24px;
      z-index: 5;
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .markdown-container {
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      padding: 60px 24px 24px 24px;
      overflow-y: auto;
      background: #151f2a;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
    }
    .markdown-body {
      max-width: 800px;
      margin: 0 auto;
    }
    .markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4 {
      color: #f1f5f9;
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      font-weight: 600;
      line-height: 1.25;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      padding-bottom: 0.3em;
    }
    .markdown-body h1 { font-size: 2em; }
    .markdown-body h2 { font-size: 1.5em; }
    .markdown-body h3 { font-size: 1.25em; }
    .markdown-body p { margin-top: 0; margin-bottom: 1em; }
    .markdown-body ul, .markdown-body ol { padding-left: 2em; margin-bottom: 1em; }
    .markdown-body li { margin-bottom: 0.3em; }
    .markdown-body code {
      background: rgba(255,255,255,0.1);
      padding: 0.2em 0.4em;
      border-radius: 4px;
      font-family: monospace;
      font-size: 0.9em;
    }
    .markdown-body pre {
      background: #0f172a;
      padding: 1em;
      border-radius: 8px;
      overflow-x: auto;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .markdown-body pre code { background: none; padding: 0; }
    .markdown-body blockquote {
      border-left: 4px solid #38bdf8;
      margin: 1em 0;
      padding-left: 1em;
      color: #cbd5e1;
      font-style: italic;
    }
    .markdown-body table {
      border-collapse: collapse;
      width: 100%;
      margin-bottom: 1em;
    }
    .markdown-body th, .markdown-body td {
      border: 1px solid rgba(255,255,255,0.15);
      padding: 8px 12px;
      text-align: left;
    }
    .markdown-body th {
      background: rgba(255,255,255,0.1);
    }
    .markdown-body img {
      max-width: 100%;
      height: auto;
      border-radius: 6px;
    }
  `;

  constructor() {
    super();
    this.images = [];
    this.activeSlideIndex = 0;
    this.ocrState = null;
  }

  handleBackClick() {
    this.dispatchEvent(
      new CustomEvent('copio-carousel:close', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  handleSlideChange(e) {
    this.activeSlideIndex = e.detail?.index || 0;
  }

  async handleOcrClick() {
    const currentImg = this.images[this.activeSlideIndex];
    if (!currentImg || currentImg.type === 'markdown' || !currentImg.src) return;

    this.ocrState = {
      isOpen: true,
      lang: 'eng',
      step: 'processing',
      progress: 0,
      statusMessage: 'Starting OCR...',
      resultText: '',
      confidence: 0,
      copied: false,
    };

    this.runSlideOcr(currentImg.src, 'eng');
  }

  async runSlideOcr(src, lang) {
    try {
      const result = await recognizeImageText(src, {
        lang,
        onProgress: ({ progress, message }) => {
          if (this.ocrState && this.ocrState.isOpen) {
            this.ocrState = {
              ...this.ocrState,
              progress: Math.round((progress || 0) * 100),
              statusMessage: message || 'Processing...',
            };
          }
        },
      });

      if (this.ocrState && this.ocrState.isOpen) {
        this.ocrState = {
          ...this.ocrState,
          step: 'done',
          resultText: result.text || '',
          confidence: result.confidence || 0,
        };
      }
    } catch (err) {
      console.error('Slide OCR Error:', err);
      if (this.ocrState && this.ocrState.isOpen) {
        this.ocrState = {
          ...this.ocrState,
          step: 'error',
          statusMessage: err.message || 'Recognition failed',
        };
      }
    }
  }

  handleOcrLangChange(e) {
    const newLang = e.target.value;
    const currentImg = this.images[this.activeSlideIndex];
    if (!currentImg || !currentImg.src) return;

    this.ocrState = {
      ...this.ocrState,
      lang: newLang,
      step: 'processing',
      progress: 0,
      statusMessage: 'Initializing OCR...',
    };

    this.runSlideOcr(currentImg.src, newLang);
  }

  async copyOcrText() {
    if (!this.ocrState?.resultText) return;
    try {
      await navigator.clipboard.writeText(this.ocrState.resultText);
      this.ocrState = { ...this.ocrState, copied: true };
      setTimeout(() => {
        if (this.ocrState) {
          this.ocrState = { ...this.ocrState, copied: false };
        }
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  }

  closeOcrModal() {
    this.ocrState = null;
  }

  renderItem(img) {
    if (img.type === 'markdown') {
      const rawContent = img.content || '';
      const htmlContent = window.marked && window.marked.parse ? window.marked.parse(rawContent) : rawContent;
      return html`
        <sl-carousel-item data-id="${img.id}">
          <div class="markdown-container">
            <div class="markdown-body" .innerHTML=${htmlContent}></div>
          </div>
        </sl-carousel-item>
      `;
    }
    return html`
      <sl-carousel-item data-id="${img.id}">
        <div class="item" style="background-image: url('${img.src}')"></div>
      </sl-carousel-item>
    `;
  }

  renderOcrDialog() {
    if (!this.ocrState || !this.ocrState.isOpen) return '';

    const currentImg = this.images[this.activeSlideIndex];
    const isImage = currentImg && currentImg.type !== 'markdown';

    return html`
      <sl-dialog
        label="Extract Text (OCR) — Page ${this.activeSlideIndex + 1}"
        open
        style="--width: 80vw"
        @sl-after-hide=${this.closeOcrModal}
      >
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid #e2e8f0; flex-wrap: wrap; gap: 8px;">
          <sl-select
            size="small"
            value=${this.ocrState.lang}
            @sl-change=${this.handleOcrLangChange}
            style="min-width: 180px;"
          >
            ${SUPPORTED_LANGUAGES.map(
              (l) => html`<sl-option value=${l.code}>${l.flag} ${l.label}</sl-option>`,
            )}
          </sl-select>

          ${this.ocrState.step === 'done'
            ? html`
                <sl-badge
                  variant=${this.ocrState.confidence >= 75
                    ? 'success'
                    : this.ocrState.confidence >= 50
                      ? 'warning'
                      : 'danger'}
                >
                  ${this.ocrState.confidence}% Confidence
                </sl-badge>
              `
            : ''}
        </div>

        ${this.ocrState.step === 'processing'
          ? html`
              <div style="padding: 2rem 0; text-align: center;">
                <div style="font-size: 1rem; color: #0284c7; font-weight: 600; margin-bottom: 1rem;">
                  ${this.ocrState.statusMessage}
                </div>
                <sl-progress-bar value=${this.ocrState.progress}></sl-progress-bar>
                <div style="font-size: 0.8rem; color: #64748b; margin-top: 0.6rem;">
                  Client-side WebAssembly text recognition
                </div>
              </div>
            `
          : ''}

        ${this.ocrState.step === 'error'
          ? html`
              <div style="padding: 1.5rem; text-align: center; color: #ef4444;">
                <sl-icon name="x-circle-fill" style="font-size: 2rem;"></sl-icon>
                <p>${this.ocrState.statusMessage}</p>
              </div>
            `
          : ''}

        ${this.ocrState.step === 'done'
          ? html`
              <div>
                <sl-textarea
                  rows="10"
                  .value=${this.ocrState.resultText}
                  @input=${(e) => {
                    this.ocrState = { ...this.ocrState, resultText: e.target.value };
                  }}
                  placeholder="Extracted text..."
                ></sl-textarea>
              </div>
            `
          : ''}

        <sl-button slot="footer" variant="default" @click=${this.closeOcrModal}>Close</sl-button>
        ${this.ocrState.step === 'done'
          ? html`
              <sl-button slot="footer" variant="primary" @click=${this.copyOcrText}>
                <sl-icon slot="prefix" name=${this.ocrState.copied ? 'check' : 'clipboard'}></sl-icon>
                ${this.ocrState.copied ? 'Copied!' : 'Copy Text'}
              </sl-button>
            `
          : ''}
      </sl-dialog>
    `;
  }

  render() {
    const currentImg = this.images[this.activeSlideIndex];
    const isImage = currentImg && currentImg.type !== 'markdown';

    return html`
      <button class="back" @click=${this.handleBackClick}>←</button>

      ${isImage
        ? html`
            <div class="carousel-top-actions">
              <sl-button size="small" variant="default" pill @click=${this.handleOcrClick}>
                <sl-icon slot="prefix" name="card-text"></sl-icon>
                OCR
              </sl-button>
            </div>
          `
        : ''}

      <sl-carousel
        class="sl-carousel"
        orientation="vertical"
        @sl-slide-change=${this.handleSlideChange}
      >
        ${this.images.map((img) => this.renderItem(img))}
      </sl-carousel>

      ${this.renderOcrDialog()}
    `;
  }
}

customElements.define('copio-carousel', CopioCarousel);
