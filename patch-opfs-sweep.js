import fs from 'fs';
let content = fs.readFileSync('js/services/adapters/opfs-adapter.js', 'utf8');

const sweepMethod = `
  async #sweepOrphans() {
    try {
      const root = await navigator.storage.getDirectory();
      const copioDir = await root.getDirectoryHandle('copio');
      const docsDir = await copioDir.getDirectoryHandle('docs');
      
      const validIds = new Set(Object.keys(this.store.getTable('docs')));
      
      for await (const [name, handle] of docsDir.entries()) {
        if (handle.kind === 'directory' && !validIds.has(name)) {
          console.log(\`[OPFS] Sweeping orphaned directory: \${name}\`);
          await docsDir.removeEntry(name, { recursive: true });
        }
      }
    } catch (e) {
      // Ignore if directories don't exist yet
    }
  }
`;

content = content.replace("  async init() {", sweepMethod + "\n  async init() {");
content = content.replace("await this.persister.startAutoSave();", "await this.persister.startAutoSave();\n    await this.#sweepOrphans();");

fs.writeFileSync('js/services/adapters/opfs-adapter.js', content);
