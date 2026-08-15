/**
 * Lightweight, zero-dependency client-side Hash Router for Copio SPA.
 */

export const ROUTES = [
  { path: '/', name: 'home' },
  { path: '/add', name: 'add' },
  { path: '/doc/:id', name: 'doc-view' },
  { path: '/doc/:id/edit', name: 'doc-edit' },
  { path: '/sync', name: 'sync-host' },
  { path: '/sync/:peer', name: 'sync-join' },
];

export class SimpleRouter {
  #routes = [];
  #listeners = new Set();
  #currentRoute = null;

  constructor(routes = ROUTES) {
    this.#routes = routes;

    window.addEventListener('hashchange', () => this.handleRoute());
    window.addEventListener('popstate', () => this.handleRoute());
  }

  onRouteChange(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
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
        const routeData = {
          name: route.name,
          path: currentPath,
          params,
        };
        this.#currentRoute = routeData;
        for (const listener of this.#listeners) {
          listener(routeData);
        }
        return routeData;
      }
    }

    const fallback = { name: 'home', path: '/', params: {} };
    this.#currentRoute = fallback;
    for (const listener of this.#listeners) {
      listener(fallback);
    }
    return fallback;
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

export const router = new SimpleRouter(ROUTES);
