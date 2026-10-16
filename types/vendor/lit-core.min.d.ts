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
