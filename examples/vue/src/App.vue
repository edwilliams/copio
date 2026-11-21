<template>
  <main class="app">
    <header class="header">
      <h1>Copio SDK — Vue 3</h1>
      <p class="status">{{ status }}</p>
    </header>

    <div class="scanner-box">
      <copio-scanner
        ref="scannerRef"
        mode="batch"
        aspect="a4"
        theme="dark"
        @copio:scan-complete="onScanComplete"
      />
    </div>

    <div class="actions">
      <button type="button" :disabled="exporting" @click="handleExportPdf">
        {{ exporting ? 'Exporting...' : 'Export PDF' }}
      </button>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import '@copio/sdk';
import { setAssetBase, type CopioScanner } from '@copio/sdk';

setAssetBase('/copio-sdk');

const scannerRef = ref<CopioScanner | null>(null);
const status = ref('Capture or import a page, then click Done or Export PDF.');
const exporting = ref(false);

function onScanComplete(event: Event) {
  const { pageCount, pages } = (event as CustomEvent<{ pageCount: number; pages: unknown[] }>).detail;
  status.value = `Scan complete: ${pageCount} page(s) ready.`;
  console.log('copio:scan-complete', pages);
}

async function handleExportPdf() {
  const scanner = scannerRef.value;
  if (!scanner) return;

  const pages = await scanner.getPages();
  if (!pages.length) {
    status.value = 'Capture or import at least one page before exporting.';
    return;
  }

  exporting.value = true;
  status.value = 'Exporting PDF...';
  try {
    await scanner.exportPdf({ docName: 'vue-scan', download: true });
    status.value = `Exported ${pages.length} page(s) to vue-scan.pdf.`;
  } finally {
    exporting.value = false;
  }
}
</script>
