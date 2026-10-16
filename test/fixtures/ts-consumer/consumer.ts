import {
  CopioScanner,
  CopioEngine,
  COPIO_EVENTS,
  dispatchCopioEvent,
  MemoryStorageAdapter,
  IndexedDbStorageAdapter,
  LicenseManager,
  BUILD_DATE,
  VERSION,
} from '@copio/sdk';

// 1. Test instantiation and typed properties on CopioScanner
const scanner: CopioScanner = new CopioScanner();
scanner.mode = 'document';
scanner.features = ['crop', 'rotate', 'ocr'];
scanner.maxPages = 20;
scanner.exportFormats = ['pdf', 'zip'];
scanner.ocrLanguages = ['eng'];

const currentMode: 'single' | 'document' = scanner.mode;
const currentDocId: string | null = scanner.docId;
const maxPages: number = scanner.maxPages;
const isOpen: boolean = scanner.isOpen;
const hasCrop: boolean = scanner.hasFeature('crop');

// 2. Test typed methods on CopioScanner
async function testScannerMethods() {
  await scanner.open();
  const page = await scanner.capture();
  const pages = await scanner.getPages();
  const pdfBlob: Blob = await scanner.exportPdf({ download: false });
  const zipBlob: Blob = await scanner.exportZip({ download: false });
  const ocrResult = await scanner.ocr();
  await scanner.clear();
  await scanner.close();
}

// 3. Test typed events
scanner.addEventListener('copio:page-added', (e: Event) => {
  const customEvent = e as CustomEvent;
  console.log('Page added:', customEvent.detail);
});

// 4. Test document.createElement augmentation
const createdEl = document.createElement('copio-scanner');
createdEl.mode = 'single';

// 5. Test headless CopioEngine & MemoryStorageAdapter
const memoryStorage = new MemoryStorageAdapter();
const engine = new CopioEngine({
  storage: memoryStorage,
  features: ['crop', 'ocr'],
  maxPages: 10,
});

async function testEngine() {
  await engine.init();
  const doc = await engine.createDocument('Invoice', [
    { id: 'p1', src: 'data:image/png;base64,...' },
  ]);
  const docs = await engine.listDocuments();
  const fetched = await engine.getDocument(doc.id);
  await engine.deleteDocument(doc.id);
}
