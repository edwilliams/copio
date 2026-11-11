import {
  CopioScanner,
  CopioEngine,
  COPIO_EVENTS,
  dispatchCopioEvent,
  MigrationRunner,
  CURRENT_SCHEMA_VERSION,
  DEFAULT_MIGRATIONS,
  MemoryStorageAdapter,
  IndexedDbStorageAdapter,
  NullOcrAdapter,
  NullPdfAdapter,
  ImageProcessorPort,
  Canvas2DAdapter,
  NullImageProcessorAdapter,
  SyncPort,
  NullSyncAdapter,
  EdgeDetectorPort,
  NullEdgeDetectorAdapter,
  ScanicWasmEdgeAdapter,
  DEFAULT_FALLBACK_QUAD,
  Document as CopioDocument,
  Page as CopioPage,
  ScanSession,
  LicenseManager,
  BUILD_DATE,
  VERSION,
  HandoffSession,
  LoopbackTransport,
  CopioHandoff,
} from '@copio/sdk';

// 1. Test instantiation and typed properties on CopioScanner
const scanner: CopioScanner = new CopioScanner();
scanner.mode = 'document';
scanner.features = ['crop', 'rotate', 'ocr'];
scanner.maxPages = 20;
scanner.exportFormats = ['pdf', 'zip'];
scanner.ocrLanguages = ['eng'];
scanner.theme = 'light';
scanner.ocrEnabled = true;
scanner.pdf = true;
scanner.handoff = 'https://example.com/scan#handoff=token';

const currentMode: 'single' | 'document' = scanner.mode;
const currentDocId: string | null = scanner.docId;
const currentTheme: 'dark' | 'light' | 'brand' | 'auto' = scanner.theme;
const maxPages: number = scanner.maxPages;
const isOpen: boolean = scanner.isOpen;
const hasCrop: boolean = scanner.hasFeature('crop');
const isOcrEnabled: boolean = scanner.ocrEnabled;
const isPdfEnabled: boolean = scanner.pdf;
const isHandoffActive: boolean = scanner.isHandoff;
const scannerHandoffState: string = scanner.handoffState;

// 2. Test typed methods on CopioScanner
async function testScannerMethods() {
  await scanner.open();
  const page = await scanner.capture();
  const pages = await scanner.getPages();
  const pdfBlob: Blob = await scanner.exportPdf({ download: false });
  const zipBlob: Blob = await scanner.exportZip({ download: false });
  const ocrResult = await scanner.ocr();
  await scanner.completeScan();
  await scanner.reconnectHandoff();
  await scanner.resetHandoff();
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
  ocr: false,
  pdf: false,
});
const optInOcr: boolean = engine.ocr;
const optInPdf: boolean = engine.pdf;
const nullOcr = new NullOcrAdapter();
const nullPdf = new NullPdfAdapter();

async function testEngine() {
  await engine.init();
  const doc = await engine.createDocument('Invoice', [
    { id: 'p1', src: 'data:image/png;base64,...' },
  ]);
  const docs = await engine.listDocuments();
  const fetched = await engine.getDocument(doc.id);
  await engine.deleteDocument(doc.id);
}

// 6. Test Data Migration Framework (CPO-013)
const schemaVer: number = CURRENT_SCHEMA_VERSION;
const defaultMigrations = DEFAULT_MIGRATIONS;
const migrationEventName: string = COPIO_EVENTS.MIGRATION;
async function testMigrationRunner() {
  const migStorage = new MemoryStorageAdapter();
  await migStorage.init();
  const res = await MigrationRunner.run({ storage: migStorage });
  const isFresh: boolean = res.fresh;
  const toVer: number = res.toVersion;
}

// 6. Test Hexagonal Ports & Domain Models
const imgProcessor: ImageProcessorPort = new NullImageProcessorAdapter();
const syncPort: SyncPort = new NullSyncAdapter();
const edgePort: EdgeDetectorPort = new NullEdgeDetectorAdapter();
const scanicEdge: EdgeDetectorPort = new ScanicWasmEdgeAdapter();
const fallbackTlX: number = DEFAULT_FALLBACK_QUAD.topLeft.x;
const domainPage = new CopioPage({ id: 'p1', src: 'data:image/png;base64,...' });
const domainDoc = new CopioDocument({ id: 'd1', name: 'Receipt', pages: [domainPage] });
const session = new ScanSession({ mode: 'single', aspect: 'receipt' });

// 7. Test Phone-to-Desktop Handoff Session (CPO-090)
const [hostTransport, senderTransport] = LoopbackTransport.createPair();
const hostSession = new HandoffSession({ role: 'host', transport: hostTransport });
const senderSession = new HandoffSession({ role: 'sender', transport: senderTransport });
async function testHandoff() {
  const { token, url } = await hostSession.startHost({ baseUrl: 'https://example.com' });
  await senderSession.startSender(token);
  await senderSession.sendPage({
    id: 'p1',
    blob: new Uint8Array([1, 2, 3]),
  });
  await senderSession.complete();
}

// 8. Test <copio-handoff> Desktop Web Component (CPO-091 / CPO-092)
const handoffEl: CopioHandoff = new CopioHandoff();
handoffEl.mode = 'batch';
handoffEl.theme = 'light';
handoffEl.ttlMs = 300000;
handoffEl.relayUrl = 'https://relay.example.com';
handoffEl.signalingUrl = 'wss://relay.example.com';
handoffEl.iceTransportPolicy = 'relay';
const handoffMode: string = handoffEl.mode;
const handoffState: string = handoffEl.state;
const handoffPages: Array<any> = handoffEl.pages;
const handoffRelay: string = handoffEl.relayUrl;

// 9. Test Engine Relay Config (CPO-092)
const relayEngine = new CopioEngine({
  relayUrl: 'https://relay.example.com',
  signalingUrl: 'wss://relay.example.com',
  iceTransportPolicy: 'relay',
});
const engineRelayUrl: string = relayEngine.relayUrl;

const createdHandoff = document.createElement('copio-handoff');
createdHandoff.mode = 'single';
createdHandoff.addEventListener('copio:connection-info', (e: Event) => {
  const ce = e as CustomEvent;
  console.log('Connection info:', ce.detail);
});
createdHandoff.addEventListener('copio:handoff-connected', (e: Event) => {
  const ce = e as CustomEvent;
  console.log('Handoff connected:', ce.detail);
});
createdHandoff.addEventListener('copio:page-added', (e: Event) => {
  const ce = e as CustomEvent;
  console.log('Handoff page added:', ce.detail);
});
createdHandoff.addEventListener('copio:scan-complete', (e: Event) => {
  const ce = e as CustomEvent;
  console.log('Handoff scan complete:', ce.detail);
});
