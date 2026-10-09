import fs from 'fs';
let content = fs.readFileSync('js/services/adapters/indexed-db-adapter.js', 'utf8');

const sweepMethod = `
  async #sweepOrphans() {
    const validIds = new Set(Object.keys(this.store.getTable('docs')));
    try {
      const db = await this.#getDb();
      await new Promise((resolve) => {
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.getAllKeys();
        request.onsuccess = () => {
          for (const key of request.result) {
            const docId = key.split('_')[0];
            if (!validIds.has(docId)) {
              console.log(\`[IndexedDB] Sweeping orphaned page blob: \${key}\`);
              store.delete(key);
            }
          }
          resolve();
        };
        request.onerror = () => resolve();
      });
    } catch (e) {
      // ignore
    }
  }
`;

content = content.replace("  async init() {", sweepMethod + "\n  async init() {");
content = content.replace("await this.persister.startAutoSave();", "await this.persister.startAutoSave();\n    await this.#sweepOrphans();");

fs.writeFileSync('js/services/adapters/indexed-db-adapter.js', content);
