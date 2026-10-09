import { createCustomPersister } from './tinybase-persisters.js';

export function createOpfsPersister(store, path) {
  return createCustomPersister(
    store,
    async () => {
      try {
        const dir = await navigator.storage.getDirectory();
        
        // Handle nested paths (e.g. 'copio/store.json')
        const parts = path.split('/');
        const filename = parts.pop();
        let currentDir = dir;
        
        for (const part of parts) {
          currentDir = await currentDir.getDirectoryHandle(part, { create: true });
        }
        
        const fileHandle = await currentDir.getFileHandle(filename);
        const file = await fileHandle.getFile();
        const text = await file.text();
        return JSON.parse(text);
      } catch (e) {
        return undefined;
      }
    },
    async (getContent) => {
      const data = await getContent();
      const text = JSON.stringify(data);
      // console.log('SAVING TO OPFS, text:', text);
      const dir = await navigator.storage.getDirectory();
      
      const parts = path.split('/');
      const filename = parts.pop();
      let currentDir = dir;
      
      for (const part of parts) {
        currentDir = await currentDir.getDirectoryHandle(part, { create: true });
      }
      
      const fileHandle = await currentDir.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(text);
      await writable.close();
    },
    () => {}, // No external change listener for OPFS in this version
    () => {}
  );
}
