import fs from 'fs';
let content = fs.readFileSync('js/components/copio-header.js', 'utf8');

if (!content.includes('import { docRepository }')) {
  content = content.replace(
    "import { LitElement, html, css } from '../lib/lit-core.min.js';",
    "import { LitElement, html, css } from '../lib/lit-core.min.js';\nimport { docRepository } from '../services/doc-repository.js';"
  );
}

const propsOld = `  static properties = {
    _storageEstimate: { state: true },
    _isPersisted: { state: true },
  };`;

const propsNew = `  static properties = {
    _storageEstimate: { state: true },
    _isPersisted: { state: true },
    _storageKind: { state: true },
  };`;
content = content.replace(propsOld, propsNew);

const updateOld = `  async updateStorageInfo() {
    if (navigator.storage) {
      if (navigator.storage.persisted) {
        this._isPersisted = await navigator.storage.persisted();
      }
      if (navigator.storage.estimate) {
        this._storageEstimate = await navigator.storage.estimate();
      }
    }
  }`;

const updateNew = `  async updateStorageInfo() {
    if (navigator.storage) {
      if (navigator.storage.persisted) {
        this._isPersisted = await navigator.storage.persisted();
      }
      if (navigator.storage.estimate) {
        this._storageEstimate = await navigator.storage.estimate();
      }
    }
    if (docRepository && docRepository.adapter) {
       this._storageKind = docRepository.adapter.constructor.name.replace('Adapter', '');
    }
  }`;
content = content.replace(updateOld, updateNew);

const menuOld = `              <sl-menu-item disabled>
                Storage: \${this._formatBytes(this._storageEstimate?.usage)} 
                (\${this._isPersisted ? 'Persisted' : 'Volatile'})
              </sl-menu-item>`;

const menuNew = `              <sl-menu-item disabled>
                Storage: \${this._formatBytes(this._storageEstimate?.usage)} 
                (\${this._isPersisted ? 'Persisted' : 'Volatile'} - \${this._storageKind || 'Unknown'})
              </sl-menu-item>`;
content = content.replace(menuOld, menuNew);

fs.writeFileSync('js/components/copio-header.js', content);
