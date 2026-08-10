/**
 * Lightweight, zero-dependency client-side Hash Router for Copio SPA.
 */
export class SimpleRouter {
  #routes = [];

  constructor(routes = []) {
    this.#routes = routes;

    window.addEventListener('hashchange', () => this.handleRoute());
    window.addEventListener('popstate', () => this.handleRoute());
  }

  getHashPath() {
    const hash = window.location.hash;
    if (!hash || hash === '#' || hash === '#/') return '/';
    return hash.startsWith('#') ? hash.slice(1) : hash;
  }

  navigate(path) {
    const targetHash = path === '/' ? '' : `#${path}`;
    if (window.location.hash !== targetHash) {
      if (path === '/') {
        window.history.pushState({}, '', window.location.pathname + window.location.search);
      } else {
        window.location.hash = targetHash;
      }
    }
    this.handleRoute();
  }

  handleRoute() {
    const currentPath = this.getHashPath();
    for (const route of this.#routes) {
      const params = this.#matchRoute(route.path, currentPath);
      if (params !== null) {
        route.render(params);
        return;
      }
    }
  }

  #matchRoute(pattern, path) {
    const patternParts = pattern.split('/').filter(Boolean);
    const pathParts = path.split('/').filter(Boolean);

    if (patternParts.length !== pathParts.length) return null;

    const params = {};
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        const paramName = patternParts[i].slice(1);
        params[paramName] = pathParts[i];
      } else if (patternParts[i] !== pathParts[i]) {
        return null;
      }
    }
    return params;
  }
}
