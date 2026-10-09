import fs from 'fs';

let content = fs.readFileSync('js/services/doc-repository.js', 'utf8');

if (!content.includes("import { runMigrations }")) {
  content = content.replace(
    "import { IndexedDbAdapter } from './adapters/indexed-db-adapter.js';",
    "import { IndexedDbAdapter } from './adapters/indexed-db-adapter.js';\nimport { runMigrations } from '../core/migrations.js';"
  );
}

const oldInit = `  async init() {
    if (!this.adapter) {
      if (await OpfsAdapter.isSupported()) {
        this.adapter = new OpfsAdapter();
      } else {
        this.adapter = new IndexedDbAdapter();
      }
    }
    return this.adapter.init();
  }`;

const newInit = `  async init() {
    if (!this.adapter) {
      if (await OpfsAdapter.isSupported()) {
        this.adapter = new OpfsAdapter();
      } else {
        this.adapter = new IndexedDbAdapter();
      }
    }
    const result = await this.adapter.init();
    await runMigrations(this);
    return result;
  }`;

content = content.replace(oldInit, newInit);

fs.writeFileSync('js/services/doc-repository.js', content);
