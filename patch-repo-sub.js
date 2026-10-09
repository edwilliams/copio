import fs from 'fs';
let content = fs.readFileSync('js/services/doc-repository.js', 'utf8');

const classDecl = `export class DocRepository {
  constructor(adapter = null) {
    this.adapter = adapter;
    this.listeners = new Set();
  }`;

content = content.replace(/export class DocRepository \{\n  constructor\(adapter = null\) \{\n    this.adapter = adapter;\n  \}/, classDecl);

const initOld = `    const result = await this.adapter.init();
    this.adapter.persistent = result.persistent;
    await runMigrations(this);
    return result;`;

const initNew = `    const result = await this.adapter.init();
    this.adapter.persistent = result.persistent;
    await runMigrations(this);
    this.adapter.subscribe(() => {
      for (const cb of this.listeners) cb();
    });
    return result;`;
content = content.replace(initOld, initNew);

const subscribeOld = `  subscribe(callback) {
    return this.adapter?.subscribe(callback);
  }`;

const subscribeNew = `  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }`;
content = content.replace(subscribeOld, subscribeNew);

fs.writeFileSync('js/services/doc-repository.js', content);
