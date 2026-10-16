// Ambient declarations for vendored ESM and script modules in js/lib/

declare module '*/lit-core.min.js' {
  export class LitElement extends HTMLElement {
    static properties: Record<string, any>;
    static styles: any;
    render(): any;
    firstUpdated(_changedProperties?: any): void;
    updated(_changedProperties?: any): void;
    connectedCallback(): void;
    disconnectedCallback(): void;
    requestUpdate(name?: PropertyKey, oldValue?: unknown): Promise<unknown>;
  }
  export function html(strings: TemplateStringsArray, ...values: any[]): any;
  export function css(strings: TemplateStringsArray, ...values: any[]): any;
}

declare module '*/tinybase.6.5.2.js' {
  export function createStore(): any;
}

declare module '*/tinybase-persister-indexed-db.js' {
  export function createIndexedDbPersister(store: any, dbName: string): any;
}

declare module '*/sortable.esm.js' {
  export default class Sortable {
    static create(el: HTMLElement, options?: any): Sortable;
    static get(el: HTMLElement): Sortable | undefined;
    destroy(): void;
  }
}

declare module '*/cropper.js' {
  export default class Cropper {
    constructor(element: HTMLImageElement, options?: any);
    destroy(): void;
    getData(): any;
    setData(data: any): void;
    getCroppedCanvas(options?: any): HTMLCanvasElement;
  }
}

declare module '*/pdfkit.js';
declare module '*/pdf.worker.min.mjs';
declare module '*/pdf.min.mjs';
declare module '*/tesseract.min.js';
declare module '*/tesseract-worker.min.js';
declare module '*/peerjs.min.js';
declare module '*/jszip.min.js';
declare module '*/qrcode.js';
declare module '*/marked.min.js';
declare module '*/exifr.js';
declare module '*/shoelace.js';

declare global {
  const __BUILD_DATE__: string | undefined;
  class Cropper {
    constructor(element: HTMLImageElement, options?: any);
    destroy(): void;
    getData(): any;
    setData(data: any): void;
    getCroppedCanvas(options?: any): HTMLCanvasElement;
  }

  interface Window {
    Copio?: any;
    Cropper?: any;
    PDFDocument?: any;
    JSZip?: any;
    marked?: any;
    Peer?: any;
    qrcode?: any;
    Tesseract?: any;
  }

  interface CustomElementConstructor {
    toastStack?: HTMLElement;
  }

  interface HTMLElementTagNameMap {
    'sl-dialog': HTMLElement & { open: boolean; show(): Promise<void>; hide(): Promise<void>; [key: string]: any };
    'sl-input': HTMLInputElement & { value: string; [key: string]: any };
    'sl-button': HTMLButtonElement & { size?: string; variant?: string; [key: string]: any };
    'sl-icon': HTMLElement & { name?: string; [key: string]: any };
    'sl-icon-button': HTMLElement & { name?: string; [key: string]: any };
    'sl-progress-bar': HTMLElement & { value: number; indeterminate: boolean; [key: string]: any };
    'sl-alert': HTMLElement & { open: boolean; variant?: string; closable?: boolean; duration?: number; toastPromise?: Promise<void>; toast(): Promise<void>; hide(): Promise<void>; [key: string]: any };
    'sl-dropdown': HTMLElement & { open: boolean; [key: string]: any };
    'sl-menu': HTMLElement & { [key: string]: any };
    'sl-menu-item': HTMLElement & { value: string; disabled: boolean; [key: string]: any };
    'sl-tooltip': HTMLElement & { content: string; [key: string]: any };
  }
}

export {};
