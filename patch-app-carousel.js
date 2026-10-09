import fs from 'fs';
let content = fs.readFileSync('js/components/copio-app.js', 'utf8');

const loadCarouselOld = `  #loadCarouselDoc(id) {
    const doc = this.repo.getDoc(id);
    if (!doc) return;

    const carousel = this.querySelector('copio-carousel');
    if (carousel) {
      carousel.images = doc.pages;
      this.showCarousel = true;
    }
  }`;

const loadCarouselNew = `  async #loadCarouselDoc(id) {
    const doc = this.repo.getDoc(id);
    if (!doc) return;

    const carousel = this.querySelector('copio-carousel');
    if (carousel) {
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
      carousel.images = pagesWithUrls;
      this.showCarousel = true;
    }
  }`;

content = content.replace(loadCarouselOld, loadCarouselNew);

const closeCarouselOld = `  handleCarouselClose() {
    router.navigate('/');
  }`;

const closeCarouselNew = `  handleCarouselClose() {
    this.#cleanupObjectUrls();
    router.navigate('/');
  }`;

content = content.replace(closeCarouselOld, closeCarouselNew);

// Wait, routeChange for /doc/:id also calls `#loadCarouselDoc`. Let's check `handleRouteChange`.
// In `handleRouteChange`: 
//    const viewMatch = route.match(/^\/doc\/([^\/]+)$/);
//    if (viewMatch) {
//      this.#loadCarouselDoc(viewMatch[1]);
//    }
// So `#loadCarouselDoc` becomes async, which is fine.

fs.writeFileSync('js/components/copio-app.js', content);
