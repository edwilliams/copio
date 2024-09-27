import { useState, useCallback, useRef } from 'react'
import Cropper from 'cropperjs'

const useCropper = () => {
  const [dialogCropperOpen, setDialogCropperOpen] = useState(false)
  const [pageIndex, setPageIndex] = useState(0)
  /** @type {React.MutableRefObject<Cropper | null>} */
  const cropperRef = useRef(null)

  const cropperOpen = useCallback(({ pages, pageIndex }) => {
    setPageIndex(pageIndex)
    setDialogCropperOpen(true)

    // Delay to ensure modal dialog is open and image is available in the DOM
    setTimeout(() => {
      /** @type {HTMLElement|null} */
      const el = document.getElementById('image-to-edit')
      const dataurl = pages[pageIndex].src
      el?.setAttribute('src', dataurl)

      if (el) {
        // @ts-ignore
        cropperRef.current = new Cropper(el, {
          aspectRatio: 1 / 1.414,
        })
      }
    }, 100)
  }, [])

  const cropperCancel = useCallback(() => {
    setDialogCropperOpen(false)
    if (cropperRef.current) {
      cropperRef.current.destroy()
      cropperRef.current = null
    }
  }, [])

  const cropperSave = useCallback(
    ({ pages }) => {
      if (cropperRef.current) {
        const newPages = [...pages]
        newPages[pageIndex].src = cropperRef.current.getCroppedCanvas().toDataURL('image/png')
        setDialogCropperOpen(false)

        cropperRef.current.destroy()
        cropperRef.current = null

        return newPages
      }
      return pages
    },
    [pageIndex]
  )

  return {
    dialogCropperOpen,
    cropperOpen,
    cropperCancel,
    cropperSave,
  }
}

export default useCropper
