import { useState, useCallback } from 'react'
import { getDocument } from 'utils/document'
import { createPDFArray } from './utils'

const useExportAsPDF = () => {
  const [downloadPDF, setDownloadPDF] = useState({ title: '', id: '' })

  const exportAsPDF = useCallback(async ({ title, id }) => {
    const arr = await getDocument({ id })
    const PDFArray = await createPDFArray(arr)

    setDownloadPDF({ title, id: PDFArray[0] })

    setTimeout(() => {
      /** @type {HTMLElement|null} */
      const el = document.getElementById('download')
      if (el) el.click()
    }, 100)
  }, [])

  return { downloadPDF, exportAsPDF }
}

export default useExportAsPDF
