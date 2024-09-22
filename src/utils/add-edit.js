// todo: can't add same image twice

import { thresholdImage, __rotate } from 'utils/image'

const swapArrEls = (arr, a, b) => {
  let _arr = [...arr]
  let temp = _arr[a]
  _arr[a] = _arr[b]
  _arr[b] = temp
  return _arr
}

export const _rotate = async ({ pages, pageIndex }) => {
  const page = pages.find((p, i) => i === pageIndex)
  const src = await __rotate(page.src)
  return pages.map((obj, i) => (i === pageIndex ? { ...obj, src } : obj))
}

export const changePageOrder = ({ pages, direction, pageIndex }) => {
  const newPageIndex = direction === 'left' ? pageIndex - 1 : pageIndex + 1
  const hardLeft = direction === 'left' && pageIndex === 0
  const hardRight = direction === 'right' && pageIndex === pages.length - 1

  if (hardLeft || hardRight) return

  return swapArrEls(pages, pageIndex, newPageIndex)
}

export const removePage = ({ pages, pageIndex }) => {
  const newPages = pages.filter((page, i) => {
    if (i !== pageIndex) return page
  })

  return newPages
}

export const thresholdPage = async ({ pages, pageIndex }) => {
  const calls = pages.map(async (page, i) => {
    return i === pageIndex
      ? { ...page, thresholded: true, src: await thresholdImage(page.src) }
      : { ...page }
  })

  return await Promise.all(calls)
}

export const getNextID = ({ dataurls, pages, i, useIncrement }) => {
  // e.g. multipage PDF's
  if (dataurls.length > 1) {
    const int = useIncrement // flagUsedPagesToIncrement
      ? pages.length + 1
      : pages.length + 1 + i

    return int.toString().padStart(2, '0')

    // single images
  } else {
    if (pages.length === 0) {
      return '01'
    } else {
      const arr = pages.map(song => parseInt(song.id)) // e.g. [ 1, 2, 3 ]
      const int = Math.max(...arr) // e.g. 3
      return (int + 1).toString().padStart(2, '0') // e.g. '04'
    }
  }
}
