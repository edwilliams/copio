import fs from 'fs';
let content = fs.readFileSync('js/services/doc-repository.js', 'utf8');

const initOld = `    this.adapter.subscribe(() => {
      for (const cb of this.listeners) cb();
    });
    return result;`;

const initNew = `    this.adapter.subscribe(() => {
      for (const cb of this.listeners) cb();
    });
    // Trigger listeners initially so UI gets the loaded data
    for (const cb of this.listeners) cb();
    return result;`;

content = content.replace(initOld, initNew);
fs.writeFileSync('js/services/doc-repository.js', content);
