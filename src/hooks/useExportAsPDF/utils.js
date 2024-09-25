// todo: declare this as external
// import PDFDocument from 'lib/pdfkit'
import blobStream from 'blob-stream'
const { promisify } = require('es6-promisify')

const blobToDataURL = (blob) => {
  return new Promise((resolve, reject) => {
    var a = new FileReader()
    a.readAsDataURL(blob)
    a.onload = (e) => {
      resolve(e.target.result)
    }
  })
}

export const createPDFArray = async (arr) => {
  const promises = arr.pages.map(async () => {
    const doc = new window.PDFDocument()
    const stream = doc.pipe(blobStream())
    const width = 555
    const height = width * 1.4151260504
    const finish = promisify(stream.on.bind(stream))

    arr.pages.forEach((page, i) => {
      const isLastPage = arr.pages.length === i + 1

      doc.image(page.src, 25, 0, { width, height })

      if (!isLastPage) doc.addPage()
    })

    doc.end()

    await finish('finish')

    return blobToDataURL(stream.toBlob('application/pdf'))
  })

  return await Promise.all(promises)
}
