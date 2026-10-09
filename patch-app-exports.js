import fs from 'fs';

let content = fs.readFileSync('js/components/copio-app.js', 'utf8');

const hydrateHelper = `
  async #hydratePages(id, pages) {
    return await Promise.all(pages.map(async (p) => {
      if (p.type === 'markdown') return p;
      const blob = await this.repo.getPage(id, p.id);
      if (blob) {
        const url = URL.createObjectURL(blob);
        this.#objectUrls.add(url);
        return { ...p, src: url };
      }
      return p;
    }));
  }`;

content = content.replace("  #cleanupObjectUrls() {", hydrateHelper + "\n\n  #cleanupObjectUrls() {");

const handleRowDownloadOld = `  async handleRowDownload(e) {
    const id = e.detail?.id;
    const doc = this.repo.getDoc(id);
    if (!doc) return;
    await exportDocumentAsPdf(doc.name, doc.pages);
  }`;

const handleRowDownloadNew = `  async handleRowDownload(e) {
    const id = e.detail?.id;
    const doc = this.repo.getDoc(id);
    if (!doc) return;
    const hydratedPages = await this.#hydratePages(id, doc.pages);
    await exportDocumentAsPdf(doc.name, hydratedPages);
    this.#cleanupObjectUrls();
  }`;
content = content.replace(handleRowDownloadOld, handleRowDownloadNew);

const handleRowDownloadImagesOld = `  async handleRowDownloadImages(e) {
    const id = e.detail?.id;
    const doc = this.repo.getDoc(id);
    if (!doc) return;
    await exportDocumentAsImages(doc.name, doc.pages);
  }`;

const handleRowDownloadImagesNew = `  async handleRowDownloadImages(e) {
    const id = e.detail?.id;
    const doc = this.repo.getDoc(id);
    if (!doc) return;
    const hydratedPages = await this.#hydratePages(id, doc.pages);
    await exportDocumentAsImages(doc.name, hydratedPages);
    this.#cleanupObjectUrls();
  }`;
content = content.replace(handleRowDownloadImagesOld, handleRowDownloadImagesNew);

const handleRowExtractOcrOld = `  handleRowExtractOcr(e) {
    const id = e.detail?.id;
    const doc = this.repo.getDoc(id);
    if (!doc) return;

    const imagePages = doc.pages.filter((p) => p.type !== 'markdown' && p.src);

    if (imagePages.length === 0) {
      alert('This document does not contain any image pages to perform text recognition on.');
      return;
    }

    const ocrDialog = this.querySelector('copio-doc-ocr-dialog');
    if (ocrDialog) {
      ocrDialog.open(id, doc.name, doc.pages);
    }
  }`;

const handleRowExtractOcrNew = `  async handleRowExtractOcr(e) {
    const id = e.detail?.id;
    const doc = this.repo.getDoc(id);
    if (!doc) return;

    const hydratedPages = await this.#hydratePages(id, doc.pages);
    const imagePages = hydratedPages.filter((p) => p.type !== 'markdown' && p.src);

    if (imagePages.length === 0) {
      alert('This document does not contain any image pages to perform text recognition on.');
      this.#cleanupObjectUrls();
      return;
    }

    const ocrDialog = this.querySelector('copio-doc-ocr-dialog');
    if (ocrDialog) {
      // Note: we can't cleanup URLs immediately because the dialog stays open
      ocrDialog.open(id, doc.name, hydratedPages);
      ocrDialog.addEventListener('sl-after-hide', () => {
        this.#cleanupObjectUrls();
      }, { once: true });
    } else {
      this.#cleanupObjectUrls();
    }
  }`;
content = content.replace(handleRowExtractOcrOld, handleRowExtractOcrNew);

// Also replace the inline map inside routeChange and loadCarouselDoc to use #hydratePages
content = content.replace(/const pagesWithUrls = await Promise\.all\(doc\.pages\.map[^\)]+\)\)\;/g, 'const pagesWithUrls = await this.#hydratePages(id, doc.pages);');
// Wait, my regex might fail. Let's just do it manually with strings if possible.

// But wait, the routeChange one:
const routeChangeOldMap = `        const pagesWithUrls = await Promise.all(doc.pages.map(async (p) => {
          if (p.type === 'markdown') return p;
          const blob = await this.repo.getPage(id, p.id);
          if (blob) {
            const url = URL.createObjectURL(blob);
            this.#objectUrls.add(url);
            return { ...p, src: url };
          }
          return p;
        }));`;
content = content.replace(routeChangeOldMap, '        const pagesWithUrls = await this.#hydratePages(id, doc.pages);');

const carouselOldMap = `      const pagesWithUrls = await Promise.all(doc.pages.map(async (p) => {
        if (p.type === 'markdown') return p;
        const blob = await this.repo.getPage(id, p.id);
        if (blob) {
          const url = URL.createObjectURL(blob);
          this.#objectUrls.add(url);
          return { ...p, src: url };
        }
        return p;
      }));`;
content = content.replace(carouselOldMap, '      const pagesWithUrls = await this.#hydratePages(id, doc.pages);');


fs.writeFileSync('js/components/copio-app.js', content);
