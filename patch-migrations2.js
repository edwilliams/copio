import fs from 'fs';
let content = fs.readFileSync('js/core/migrations.js', 'utf8');

content = content.replace(
  "export async function runMigrations(adapter) {",
  "export async function runMigrations(adapter) {\n  if (!adapter.getRawStore) return;"
);
fs.writeFileSync('js/core/migrations.js', content);
