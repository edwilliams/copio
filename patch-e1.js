import fs from 'fs';
let content = fs.readFileSync('docs/tickets/E1-foundations.md', 'utf8');

content = content.replace(
  "- [ ] Chrome, Firefox, Safari 17+ use OPFS;",
  "- [x] Chrome, Firefox, Safari 17+ use OPFS;"
);
content = content.replace(
  "- [ ] Existing users' documents migrate to OPFS",
  "- [x] Existing users' documents migrate to OPFS"
);
content = content.replace(
  "- [ ] Stored size for a 20-page doc drops measurably",
  "- [x] Stored size for a 20-page doc drops measurably"
);
content = content.replace(
  "- [ ] Export, OCR and sync work on both adapters.",
  "- [x] Export, OCR and sync work on both adapters."
);
content = content.replace(
  "- [ ] Deleting a doc/page removes its files",
  "- [x] Deleting a doc/page removes its files"
);

fs.writeFileSync('docs/tickets/E1-foundations.md', content);
