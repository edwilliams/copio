// possible vanilla implementation: https://stackoverflow.com/a/37512944/2102042
import adaptiveThreshold from 'adaptive-threshold'
import getPixels from 'get-pixels'
import savePixels from 'save-pixels'
import EXIF from 'exif-js'
// todo: declare this as external
// import pdfjsLib from 'lib/pdfjs/pdf'

const MAX_HEIGHT = 2048

export const getFriendlyFileType = str => {
  switch (true) {
    case str.includes('json'):
      return 'json'
    case str.includes('png'):
      return 'png'
    case str.includes('pdf'):
      return 'pdf'
    case str.includes('jpg'):
      return 'jpg'
    case str.includes('jpeg'):
      return 'jpg'
  }
}

export const getEXIF = dataurl => {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.src = dataurl
    image.onload = () => {
      EXIF.getData(image, function () {
        const allMetaData = EXIF.getAllTags(this)
        if (allMetaData.MakerNote) delete allMetaData.MakerNote
        resolve(allMetaData)
      })
    }
  })
}

const rotate = dataurl => {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.src = dataurl
    image.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      canvas.width = image.width // / 3
      canvas.height = image.height // / 3

      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

      resolve(canvas.toDataURL())
      // it appears we no longer need to rotate image on iOS (...let's see)
      /*
      EXIF.getData(image, function() {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        const allMetaData = EXIF.getAllTags(this)
        const { PixelXDimension, PixelYDimension, Orientation } = allMetaData

        image.width = PixelXDimension || image.width
        image.height = PixelYDimension || image.height
        canvas.width = PixelXDimension || image.width
        canvas.height = PixelYDimension || image.height

        if (Orientation && Orientation === 6) {
          image.width = PixelYDimension
          image.height = PixelXDimension
          canvas.width = PixelYDimension
          canvas.height = PixelXDimension

          ctx.rotate((90 * Math.PI) / 180)
          ctx.translate(0, -canvas.width)
        }

        ctx.drawImage(image, 0, 0)
        // const imageData = ctx.getImageData(0, 0, image.width, image.height)

        resolve(canvas.toDataURL())
      })
      */
    }
  })
}

export const __rotate = dataurl => {
  return new Promise(resolve => {
    const image = new Image()
    image.src = dataurl
    image.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      canvas.width = image.width
      canvas.height = image.height

      ctx.save()
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate((-90 * Math.PI) / 180)
      ctx.drawImage(image, -image.width / 2, -image.height / 2)
      ctx.restore()

      resolve(canvas.toDataURL())
    }
  })
}

const resize = dataurl => {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.src = dataurl
    image.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (image.height > MAX_HEIGHT) {
        image.width *= MAX_HEIGHT / image.height
        image.height = MAX_HEIGHT
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      canvas.width = image.width
      canvas.height = image.height
      ctx.drawImage(image, 0, 0, image.width, image.height)
      resolve(canvas.toDataURL())
    }
  })
}

export const processPDFs = async dataurl => {
  const dataurls = []

  window.pdfjsLib.disableWorker = true

  const pdf = await window.pdfjsLib.getDocument(dataurl)

  for (let i = 0; i < pdf._pdfInfo.numPages; i++) {
    const index = i + 1

    const page = await pdf.getPage(index)

    const scale = 1.5
    const viewport = page.getViewport(scale)

    const canvas = document.createElement('canvas')
    const canvasContext = canvas.getContext('2d')
    canvas.height = viewport.height
    canvas.width = viewport.width

    await page.render({ canvasContext, viewport })

    dataurls.push(canvas.toDataURL())
  }

  return dataurls
}

export const thresholdImage = url => {
  return new Promise((resolve, reject) => {
    getPixels(url, (err, pixels) => {
      if (err) throw err
      // https://fujiharuka.github.io/node-adaptive-threshold/demo.html
      let thresholded = adaptiveThreshold(pixels, { compensation: 7, size: 14 })
      let canvas = savePixels(thresholded, 'canvas')
      resolve(canvas.toDataURL())
    })
  })
}

export const thresholdImages = pages => {
  return new Promise((resolve, reject) => {
    // NB images get thresholded multiple times
    // but with the same algorithm this doens't matter
    const arr = pages.map(page => thresholdImage(page.src))
    Promise.all(arr).then(arr => {
      resolve(arr.map(src => ({ src })))
    })
  })
}

export const processPngsAndJpgs = async dataurl => {
  // const w = new Worker('lib/process_image_thread.js')
  // w.postMessage({ dataurl })
  // w.onmessage = e => {
  //   resolve(e.data)
  // }

  return [await rotate(dataurl).then(resize) /* .then(thresholdImage) */]
}
