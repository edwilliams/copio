import { LitElement, html, css } from './lib/lit-core.min.js';

class CopioHeader extends LitElement {
  static styles = css`
    header {
      background-color: #151f2a;
      color: white;
      display: flex;
      align-items: center;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      padding: 8px;
    }
    .header-left,
    .header-right {
      flex: 1;
      display: flex;
      align-items: center;
    }
    .header-right {
      justify-content: flex-end;
    }
    h1 {
      font-size: 24px;
      margin: 0;
    }
  `;

  async #handleSelect(e) {
    if (e.detail.item.value === 'link-device') {
      this.dispatchEvent(new CustomEvent('copio-header:link-device', { bubbles: true, composed: true }));
      return;
    }
    if (e.detail.item.value !== 'clear-cache') return;

    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((r) => r.unregister()));

    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));

    window.location.reload();
  }

  render() {
    return html`
      <header>
        <div class="header-left">
          <sl-dropdown>
            <sl-icon-button
              slot="trigger"
              name="list"
              label="Menu"
              style="font-size: 1.5rem; color: white;"
            ></sl-icon-button>
            <sl-menu @sl-select=${this.#handleSelect}>
              <sl-menu-item value="link-device">Link another device</sl-menu-item>
              <sl-menu-item value="clear-cache">Clear cache &amp; update</sl-menu-item>
            </sl-menu>
          </sl-dropdown>
        </div>
        <h1>COPIO</h1>
        <div class="header-right"></div>
      </header>
    `;
  }
}

customElements.define('copio-header', CopioHeader);
