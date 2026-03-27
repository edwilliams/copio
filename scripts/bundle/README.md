# scripts/bundle

Builds third-party dependencies and generates supporting files for the app.

## Usage

From the project root:

```
npm run build
```

## What it does

1. **Bundles Shoelace** — tree-shakes and minifies only the Shoelace components listed in `src/index.js` into `js/shoelace.js` and `css/shoelace.css`, then copies icon assets to `assets/`.

2. **Generates `js/register-components.js`** — derived automatically from `src/index.js`. Registers all Shoelace and Copio custom elements, then reveals the UI once they're all defined (prevents flash of unstyled content).

3. **Generates `files-to-cache.json`** — scans `css/`, `js/`, and `fonts/` directories and detects which Shoelace icons are referenced in source, so the service worker caches exactly what's needed.

## Adding a Shoelace component

Edit `src/index.js` and add the import, then run `npm run build`. Steps 2 and 3 above update automatically.
