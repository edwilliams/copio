export const BUILD_DATE = typeof __BUILD_DATE__ !== 'undefined'
  ? __BUILD_DATE__
  : new Date().toISOString();

export const VERSION = '0.1.0';
