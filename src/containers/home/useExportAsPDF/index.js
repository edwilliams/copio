import { useState, useCallback } from 'react'
import { getSong } from 'utils/song'
import { createPDFArray } from './utils'

const useExportAsPDF = () => {
  const [downloadPDF, setDownloadPDF] = useState({ title: '', id: '' })

  const exportAsPDF = useCallback(async ({ title, id }) => {
    const arr = await getSong({ id })
    const PDFArray = await createPDFArray(arr)

    setDownloadPDF({ title, id: PDFArray[0] })

    setTimeout(() => {
      document.getElementById('download').click()
    }, 100)
  }, [])

  return { downloadPDF, exportAsPDF }
}

export default useExportAsPDF
