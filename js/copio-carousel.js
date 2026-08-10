import { LitElement, html, css } from './lit-core.min.js';

class CopioCarousel extends LitElement {
  static properties = {
    images: { type: Array },
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
      z-index: 5;
      padding: 8px 32px;
      font-size: 48px;
      cursor: pointer;
      appearance: none;
      background: none;
      border: none;
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
  }

  handleBackClick() {
    this.dispatchEvent(
      new CustomEvent('copio-carousel:close', {
        bubbles: true,
        composed: true,
      }),
    );
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

  render() {
    return html`
      <button class="back" @click=${this.handleBackClick}>←</button>
      <sl-carousel class="sl-carousel" orientation="vertical">
        ${this.images.map((img) => this.renderItem(img))}
      </sl-carousel>
    `;
  }
}

customElements.define('copio-carousel', CopioCarousel);
