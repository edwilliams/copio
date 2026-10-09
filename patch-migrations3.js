import fs from 'fs';
let content = fs.readFileSync('js/core/migrations.js', 'utf8');

content = content.replace(
  "  if (!adapter.getRawStore) return;\n  const store = adapter.getRawStore();\n  let currentVersion",
  "  if (!adapter.getRawStore) return;\n  const store = adapter.getRawStore();\n  if (!store) return;\n  let currentVersion"
);
fs.writeFileSync('js/core/migrations.js', content);
