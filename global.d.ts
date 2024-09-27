export {}

declare global {
  interface Window {
    store?: any
    PDFDocument?: any
    pdfjsLib: {
      disableWorker: boolean
      getDocument: any
    }
  }
}
