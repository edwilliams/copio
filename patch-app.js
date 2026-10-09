import fs from 'fs';

let content = fs.readFileSync('js/components/copio-app.js', 'utf8');

const cleanupSet = `
  #objectUrls = new Set();
  
  #cleanupObjectUrls() {
    for (const url of this.#objectUrls) {
      URL.revokeObjectURL(url);
    }
    this.#objectUrls.clear();
  }
`;

content = content.replace("class CopioApp extends LitElement {", "class CopioApp extends LitElement {\n" + cleanupSet);

const routeChangeOld = `  #handleRouteChange(route) {
    const editMatch = route.match(/^\\/doc\\/([^\\/]+)\\/edit$/);
    if (editMatch) {
      const id = editMatch[1];
      const doc = this.repo.getDoc(id);
      if (doc) {
        this.showCarousel = false;
        const dialog = this.querySelector('copio-add-edit-dialog');
        dialog.openEdit(doc.id, doc.name, doc.pages);
      }
    }`;

const routeChangeNew = `  async #handleRouteChange(route) {
    const editMatch = route.match(/^\\/doc\\/([^\\/]+)\\/edit$/);
    if (editMatch) {
      const id = editMatch[1];
      const doc = this.repo.getDoc(id);
      if (doc) {
        this.showCarousel = false;
        const dialog = this.querySelector('copio-add-edit-dialog');
        
        const pagesWithUrls = await Promise.all(doc.pages.map(async (p) => {
          if (p.type === 'markdown') return p;
          const blob = await this.repo.getPage(id, p.id);
          if (blob) {
            const url = URL.createObjectURL(blob);
            this.#objectUrls.add(url);
            return { ...p, src: url };
          }
          return p;
        }));
        
        dialog.openEdit(doc.id, doc.name, pagesWithUrls);
      }
    }`;

content = content.replace(routeChangeOld, routeChangeNew);

const addEditSaveOld = `  handleAddEditSave(e) {
    const { id, name, pages } = e.detail;
    this.repo.saveDoc(id, name, pages);
    router.navigate('/');
  }`;

const addEditSaveNew = `  async handleAddEditSave(e) {
    const { id, name, pages } = e.detail;
    const oldDoc = this.repo.getDoc(id);
    const oldPageIds = new Set(oldDoc ? oldDoc.pages.map(p => p.id) : []);
    
    const newPagesForMeta = [];
    
    for (const page of pages) {
      oldPageIds.delete(page.id);
      
      const pMeta = { ...page };
      
      if (page.type === 'markdown') {
        newPagesForMeta.push(pMeta);
        continue;
      }
      
      if (page.file) {
        await this.repo.savePage(id, page.id, page.file);
        delete pMeta.file;
        delete pMeta.src;
      } else if (page.src && page.src.startsWith('data:')) {
        const blob = await (await fetch(page.src)).blob();
        await this.repo.savePage(id, page.id, blob);
        delete pMeta.src;
      } else {
        delete pMeta.src;
      }
      newPagesForMeta.push(pMeta);
    }
    
    for (const deletedId of oldPageIds) {
      await this.repo.deletePage(id, deletedId);
    }
    
    this.repo.saveDoc(id, name, newPagesForMeta);
    this.#cleanupObjectUrls();
    router.navigate('/');
  }`;

content = content.replace(addEditSaveOld, addEditSaveNew);

content = content.replace(
  "  handleAddEditHide() {\n    if (router.getHashPath() !== '/') {",
  "  handleAddEditHide() {\n    this.#cleanupObjectUrls();\n    if (router.getHashPath() !== '/') {"
);

fs.writeFileSync('js/components/copio-app.js', content);
