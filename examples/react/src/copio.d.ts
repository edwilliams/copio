import type { DetailedHTMLProps, HTMLAttributes } from 'react';
import type { CopioScanner } from '@copio/sdk';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'copio-scanner': DetailedHTMLProps<HTMLAttributes<CopioScanner>, CopioScanner> & {
        mode?: 'single' | 'batch' | 'document';
        aspect?: 'a4' | 'receipt' | 'card' | 'free';
        theme?: 'dark' | 'light' | 'brand' | 'auto';
        'max-pages'?: number | string;
        'asset-base'?: string;
      };
    }
  }
}
