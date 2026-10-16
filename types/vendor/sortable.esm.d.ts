export default class Sortable {
  static create(el: HTMLElement, options?: any): Sortable;
  static get(el: HTMLElement): Sortable | undefined;
  destroy(): void;
  toArray(): string[];
}
