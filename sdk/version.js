// SPDX-License-Identifier: AGPL-3.0
// VERSION is kept in sync with package.json by scripts/build-sdk.mjs and scripts/release.mjs.
// @ts-ignore
export const BUILD_DATE = typeof __BUILD_DATE__ !== 'undefined'
  // @ts-ignore
  ? __BUILD_DATE__
  : new Date().toISOString();

// @ts-ignore
export const VERSION = typeof __VERSION__ !== 'undefined'
  // @ts-ignore
  ? __VERSION__
  : '0.1.8';
