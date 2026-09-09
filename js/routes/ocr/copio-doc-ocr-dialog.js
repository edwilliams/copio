import { LitElement, html } from '../../lib/lit-core.min.js';
import { recognizeDocumentPages, SUPPORTED_LANGUAGES } from '../../services/ocr-service.js';

class CopioDocOcrDialog extends LitElement {
  static properties = {
    isOpen: { type: Boolean, state: true },
    docId: { type: String, state: true },
    docName: { type: String, state: true },
    pages: { type: Array, state: true },
    lang: { type: String, state: true },
    step: { type: String, state: true },
    progress: { type: Number, state: true },
    statusMessage: { type: String, state: true },
    resultText: { type: String, state: true },
    confidence: { type: Number, state: true },
    copied: { type: Boolean, state: true },
  };

  createRenderRoot() {
    return this; // Use Light DOM for Shoelace dialog compatibility
  }

  constructor() {
    super();
    this.isOpen = false;
    this.docId = '';
    this.docName = '';
    this.pages = [];
    this.lang = 'eng';
    this.step = 'processing';
    this.progress = 0;
    this.statusMessage = 'Starting OCR engine...';
    this.resultText = '';
    this.confidence = 0;
    this.copied = false;
  }

  open(docId, docName, pages, lang = 'eng') {
    this.docId = docId;
    this.docName = docName || 'Document';
    this.pages = pages || [];
    this.lang = lang;
    this.step = 'processing';
    this.progress = 0;
    this.statusMessage = 'Starting OCR engine...';
    this.resultText = '';
    this.confidence = 0;
    this.copied = false;
    this.isOpen = true;

    this.startOcr(lang);
  }

  close = () => {
    this.isOpen = false;
  };

  async startOcr(lang = 'eng') {
    try {
      const result = await recognizeDocumentPages(this.pages, {
        lang,
        onPageProgress: ({ overallProgress, message }) => {
          if (this.isOpen) {
            this.progress = Math.round((overallProgress || 0) * 100);
            this.statusMessage = message;
          }
        },
      });

      if (this.isOpen) {
        this.step = 'done';
        this.resultText = result.combinedText || '';
        this.confidence = result.averageConfidence || 0;
      }
    } catch (err) {
      console.error('Document OCR Error:', err);
      if (this.isOpen) {
        this.step = 'error';
        this.statusMessage = err.message || 'Text recognition failed';
      }
    }
  }

  handleLangChange = (e) => {
    const newLang = e.target.value;
    this.lang = newLang;
    this.step = 'processing';
    this.progress = 0;
    this.statusMessage = 'Starting OCR engine with new language...';
    this.startOcr(newLang);
  };

  handleTextInput = (e) => {
    this.resultText = e.target.value;
  };

  copyText = async () => {
    if (!this.resultText) return;
    try {
      await navigator.clipboard.writeText(this.resultText);
      this.copied = true;
      setTimeout(() => {
        this.copied = false;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  downloadMarkdown = () => {
    if (!this.resultText) return;
    const safeName = (this.docName || 'document').replace(/[/\\?%*:|"<>]/g, '_');
    const blob = new Blob([this.resultText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}-ocr.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  downloadText = () => {
    if (!this.resultText) return;
    const safeName = (this.docName || 'document').replace(/[/\\?%*:|"<>]/g, '_');
    const blob = new Blob([this.resultText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}-ocr.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  saveAsNote = () => {
    if (!this.resultText || !this.docId) return;

    this.dispatchEvent(
      new CustomEvent('copio-ocr:save-note', {
        bubbles: true,
        composed: true,
        detail: {
          docId: this.docId,
          content: this.resultText,
        },
      }),
    );

    alert('OCR Transcript saved as a Markdown Note in this document!');
    this.close();
  };

  render() {
    if (!this.isOpen) return '';

    return html`
      <sl-dialog
        label="Extract All Text (OCR) — ${this.docName}"
        open
        style="--width: 85vw"
        @sl-after-hide=${this.close}
      >
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid #e2e8f0; flex-wrap: wrap; gap: 8px;">
          <sl-select
            size="small"
            value=${this.lang}
            @sl-change=${this.handleLangChange}
            style="min-width: 180px;"
          >
            ${SUPPORTED_LANGUAGES.map(
              (l) => html`<sl-option value=${l.code}>${l.flag} ${l.label}</sl-option>`,
            )}
          </sl-select>

          ${this.step === 'done'
            ? html`
                <sl-badge
                  variant=${this.confidence >= 75
                    ? 'success'
                    : this.confidence >= 50
                      ? 'warning'
                      : 'danger'}
                >
                  ${this.confidence}% Avg Confidence
                </sl-badge>
              `
            : ''}
        </div>

        ${this.step === 'processing'
          ? html`
              <div style="padding: 2.5rem 1rem; text-align: center;">
                <div style="font-size: 1.1rem; color: #0284c7; font-weight: 600; margin-bottom: 1rem;">
                  ${this.statusMessage}
                </div>
                <sl-progress-bar value=${this.progress}></sl-progress-bar>
                <div style="font-size: 0.82rem; color: #64748b; margin-top: 0.75rem;">
                  100% Client-Side WebAssembly OCR — zero cloud servers
                </div>
              </div>
            `
          : ''}

        ${this.step === 'error'
          ? html`
              <div style="padding: 2rem; text-align: center; color: #ef4444;">
                <sl-icon name="x-circle-fill" style="font-size: 2rem;"></sl-icon>
                <p style="margin-top: 0.5rem;">${this.statusMessage}</p>
              </div>
            `
          : ''}

        ${this.step === 'done'
          ? html`
              <div>
                <sl-textarea
                  rows="14"
                  .value=${this.resultText}
                  @input=${this.handleTextInput}
                  placeholder="Extracted transcript..."
                ></sl-textarea>
              </div>
            `
          : ''}

        <sl-button slot="footer" variant="default" @click=${this.close}>
          Close
        </sl-button>
        ${this.step === 'done'
          ? html`
              <sl-button slot="footer" variant="default" @click=${this.copyText}>
                <sl-icon slot="prefix" name=${this.copied ? 'check' : 'clipboard'}></sl-icon>
                ${this.copied ? 'Copied!' : 'Copy All'}
              </sl-button>
              <sl-button slot="footer" variant="default" @click=${this.downloadMarkdown}>
                <sl-icon slot="prefix" name="download"></sl-icon>
                Download .md
              </sl-button>
              <sl-button slot="footer" variant="primary" @click=${this.saveAsNote}>
                <sl-icon slot="prefix" name="file-earmark-plus"></sl-icon>
                Save as Note
              </sl-button>
            `
          : ''}
      </sl-dialog>
    `;
  }
}

customElements.define('copio-doc-ocr-dialog', CopioDocOcrDialog);
