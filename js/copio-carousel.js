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

  render() {
    return html`
      <button class="back" @click=${this.handleBackClick}>←</button>
      <sl-carousel class="sl-carousel" orientation="vertical">
        ${this.images.map(
          (img) => html`
            <sl-carousel-item data-id="${img.id}">
              <div class="item" style="background-image: url('${img.src}')"></div>
            </sl-carousel-item>
          `,
        )}
      </sl-carousel>
    `;
  }
}

customElements.define('copio-carousel', CopioCarousel);
