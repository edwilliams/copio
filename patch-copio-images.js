import fs from 'fs';

let content = fs.readFileSync('js/routes/doc/copio-images.js', 'utf8');

content = content.replace(
  "const [src, exif] = await Promise.all([fileToBase64(file), extractExif(file)]);",
  "const exif = await extractExif(file);\n          const src = URL.createObjectURL(file);\n          allImages.push({ id: randomId(), src, file, exif });\n          continue; // skip the old push"
);

// We should also replace the old push so it doesn't push twice.
content = content.replace(
  `          allImages.push({
            id: randomId(),
            src,
            exif,
          });`,
  ``
);

fs.writeFileSync('js/routes/doc/copio-images.js', content);
