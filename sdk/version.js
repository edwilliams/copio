// SPDX-License-Identifier: AGPL-3.0
// @ts-ignore
export const BUILD_DATE = typeof __BUILD_DATE__ !== 'undefined'
  // @ts-ignore
  ? __BUILD_DATE__
  : new Date().toISOString();

export const VERSION = '0.1.3';
