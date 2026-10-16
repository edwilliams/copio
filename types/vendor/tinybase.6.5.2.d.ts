export interface Store {
  getTable(tableId: string): Record<string, any>;
  setTable(tableId: string, table: Record<string, any>): Store;
  delTable(tableId: string): Store;
  getRow(tableId: string, rowId: string): Record<string, any> | undefined;
  hasRow(tableId: string, rowId: string): boolean;
  setRow(tableId: string, rowId: string, row: Record<string, any>): Store;
  delRow(tableId: string, rowId: string): Store;
  addRowListener(tableId: string | null, rowId: string | null, listener: any): string;
  delListener(listenerId: string): Store;
}
export function createStore(): Store;
