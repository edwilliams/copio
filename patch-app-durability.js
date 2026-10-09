import fs from 'fs';
let content = fs.readFileSync('js/components/copio-app.js', 'utf8');

const renderAlert = `
      <article
        class="copio-items"
        style="display: \${this.showCarousel ? 'none' : 'block'}"
      >
        <copio-header
          @copio-header:link-device=\${this.startSyncAsHost}
        ></copio-header>

        \${(!this.hideLoaderTimer && this.repo.adapter && (this.repo.adapter.constructor.name === 'IndexedDbAdapter' || !this.repo.adapter.persistent)) ? html\`
          <sl-alert variant="warning" closable open style="margin: 1rem;" class="durability-notice">
            <sl-icon slot="icon" name="exclamation-triangle"></sl-icon>
            <strong>Storage Warning:</strong> This browser may delete your documents if storage runs low.
            Export or <a href="#" @click=\${(e) => { e.preventDefault(); this.startSyncAsHost(); }}>sync</a> important documents to keep a copy.
          </sl-alert>
        \` : ''}

        <div id="copio-rows">\${this.renderRows()}</div>`;

content = content.replace(
  `      <article
        class="copio-items"
        style="display: \${this.showCarousel ? 'none' : 'block'}"
      >
        <copio-header
          @copio-header:link-device=\${this.startSyncAsHost}
        ></copio-header>

        <div id="copio-rows">\${this.renderRows()}</div>`,
  renderAlert
);

fs.writeFileSync('js/components/copio-app.js', content);
