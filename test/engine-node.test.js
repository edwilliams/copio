import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CopioEngine,
  MemoryStorageAdapter,
  NullImageProcessorAdapter,
  Document,
  Page,
  ScanSession,
} from '../sdk/core.js';

test('instantiates with MemoryStorageAdapter with zero DOM or browser globals', async () => {
  assert.strictEqual(typeof window, 'undefined');
  assert.strictEqual(typeof document, 'undefined');

  const storage = new MemoryStorageAdapter();
  const engine = new CopioEngine({
    storage,
    ocr: false,
    pdf: false,
  });

  const initResult = await engine.init();
  assert.strictEqual(initResult.kind, 'memory');
  assert.strictEqual(initResult.persistent, false);
  assert.strictEqual(engine.hasFeature('crop'), true);
  assert.strictEqual(engine.ocr, false);
  assert.strictEqual(engine.pdf, false);
});

test('creates documents, adds pages, and lists documents', async () => {
  const storage = new MemoryStorageAdapter();
  const engine = new CopioEngine({ storage });
  await engine.init();

  const created = await engine.createDocument('Contract', [
    {
      id: 'page_1',
      src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      originalSrc: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      name: 'Page 1',
      edits: { crop: null, rotate: 0, filter: 'none' },
    },
  ]);

  assert.ok(created.id);
  assert.strictEqual(created.name, 'Contract');
  assert.strictEqual(created.pages.length, 1);

  const docList = await engine.listDocuments();
  assert.strictEqual(docList.length, 1);
  assert.strictEqual(docList[0].id, created.id);

  // Add another page
  await engine.addPages(created.id, [
    {
      id: 'page_2',
      src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      originalSrc: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      name: 'Page 2',
      edits: { crop: null, rotate: 0, filter: 'none' },
    },
  ]);

  const updated = await engine.getDocument(created.id);
  assert.strictEqual(updated.pages.length, 2);
  assert.strictEqual(updated.pages[0].id, 'page_1');
  assert.strictEqual(updated.pages[1].id, 'page_2');
});

test('applies non-destructive edits and updates page while keeping originalSrc intact', async () => {
  const storage = new MemoryStorageAdapter();
  const engine = new CopioEngine({
    storage,
    imageProcessor: new NullImageProcessorAdapter(),
  });
  await engine.init();

  const originalData = 'data:image/png;base64,ORIGINAL_RAW_BYTES';
  const doc = await engine.createDocument('Receipt', [
    {
      id: 'p1',
      src: originalData,
      originalSrc: originalData,
      edits: { crop: null, rotate: 0, filter: 'none' },
    },
  ]);

  // Apply crop and rotation
  const editedPage = await engine.applyEdit(doc.id, 'p1', {
    crop: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
    rotate: 90,
    filter: 'bw',
  });

  assert.strictEqual(editedPage.originalSrc, originalData);
  assert.deepStrictEqual(editedPage.edits.crop, { x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
  assert.strictEqual(editedPage.edits.rotate, 90);
  assert.strictEqual(editedPage.edits.filter, 'bw');

  // Verify in storage
  const storedDoc = await engine.getDocument(doc.id);
  const storedPage = storedDoc.pages[0];
  assert.strictEqual(storedPage.originalSrc, originalData);
  assert.strictEqual(storedPage.edits.rotate, 90);
});

test('reorders pages in document', async () => {
  const storage = new MemoryStorageAdapter();
  const engine = new CopioEngine({ storage });
  await engine.init();

  const doc = await engine.createDocument('MultiPage', [
    { id: 'page_a', src: 'data:a' },
    { id: 'page_b', src: 'data:b' },
    { id: 'page_c', src: 'data:c' },
  ]);

  await engine.reorderPages(doc.id, ['page_c', 'page_a', 'page_b']);
  const reordered = await engine.getDocument(doc.id);
  assert.deepStrictEqual(
    reordered.pages.map((p) => p.id),
    ['page_c', 'page_a', 'page_b']
  );
});

test('supports undo and redo for edits, reordering, and page deletions', async () => {
  const storage = new MemoryStorageAdapter();
  const engine = new CopioEngine({
    storage,
    imageProcessor: new NullImageProcessorAdapter(),
  });
  await engine.init();

  const doc = await engine.createDocument('UndoDoc', [
    { id: 'page_1', src: 'data:1', edits: { crop: null, rotate: 0, filter: 'none' } },
    { id: 'page_2', src: 'data:2', edits: { crop: null, rotate: 0, filter: 'none' } },
  ]);

  // 1. Edit page_1
  await engine.applyEdit(doc.id, 'page_1', { rotate: 90 });
  let current = await engine.getDocument(doc.id);
  assert.strictEqual(current.pages[0].edits.rotate, 90);

  // Undo edit
  const undoResult = await engine.undo(doc.id);
  assert.strictEqual(undoResult.type, 'edit');
  current = await engine.getDocument(doc.id);
  assert.strictEqual(current.pages[0].edits.rotate, 0);

  // Redo edit
  const redoResult = await engine.redo(doc.id);
  assert.strictEqual(redoResult.type, 'edit');
  current = await engine.getDocument(doc.id);
  assert.strictEqual(current.pages[0].edits.rotate, 90);

  // 2. Delete page_2
  await engine.deletePage(doc.id, 'page_2');
  current = await engine.getDocument(doc.id);
  assert.strictEqual(current.pages.length, 1);

  // Undo deletion
  await engine.undo(doc.id);
  current = await engine.getDocument(doc.id);
  assert.strictEqual(current.pages.length, 2);
  assert.strictEqual(current.pages[1].id, 'page_2');
});

test('domain models instantiate cleanly', async () => {
  const page = new Page({
    id: 'p_test',
    src: 'data:img',
    edits: { rotate: 180, filter: 'bw' },
  });
  assert.strictEqual(page.id, 'p_test');
  assert.strictEqual(page.edits.rotate, 180);
  assert.strictEqual(page.edits.filter, 'bw');
  assert.strictEqual(page.isModified, true);

  const doc = new Document({
    id: 'd_test',
    name: 'Invoice 2026',
    pages: [page],
  });
  assert.strictEqual(doc.pageCount, 1);
  assert.strictEqual(doc.toJSON().name, 'Invoice 2026');

  const session = new ScanSession({
    mode: 'single',
    aspect: 'receipt',
  });
  assert.strictEqual(session.mode, 'single');
  assert.strictEqual(session.aspect, 'receipt');
  assert.strictEqual(session.stage, 'viewfinder');

  session.pushHistory({ action: 'snap' });
  assert.strictEqual(session.history.length, 1);
  assert.strictEqual(session.undo().action, 'snap');
  assert.strictEqual(session.history.length, 0);
  assert.strictEqual(session.redo().action, 'snap');
});

test.after(() => {
  process.exit(0);
});
