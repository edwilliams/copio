import fs from 'fs';
let content = fs.readFileSync('js/services/doc-repository.js', 'utf8');

const oldInit = `    const result = await this.adapter.init();
    await runMigrations(this);
    return result;`;
const newInit = `    const result = await this.adapter.init();
    this.adapter.persistent = result.persistent;
    await runMigrations(this);
    return result;`;
content = content.replace(oldInit, newInit);

fs.writeFileSync('js/services/doc-repository.js', content);
