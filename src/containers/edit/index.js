import React, { useState, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { setScreen } from 'utils/general'
import { getDocuments, getDocument, editDocument } from 'utils/document'
import { thresholdImages } from 'utils/image'
import { _rotate, changePageOrder, removePage, thresholdPage, getNextID } from 'utils/add-edit'

import { changeDocuments } from 'store/documents/actions'

import Edit from './index.jsx'

// function dataURLtoFile(dataurl, filename) {
//   var arr = dataurl.split(','),
//     mime = arr[0].match(/:(.*?);/)[1],
//     bstr = atob(arr[arr.length - 1]),
//     n = bstr.length,
//     u8arr = new Uint8Array(n)
//   while (n--) {
//     u8arr[n] = bstr.charCodeAt(n)
//   }
//   return new File([u8arr], filename, { type: mime })
// }

const EditContainer = props => {
  const dispatch = useDispatch()

  const [loading, setLoading] = useState(false)
  const [pages, setPages] = useState([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    const id = props.match.params.id_document
    init(id)
  }, [])

  const init = async id => {
    const document = await getDocument({ id })

    setTitle(document.title)
    setDescription(document.description)
    setPages(document.pages)
  }

  // duplicate
  const fileChange = async ({ name, dataurls, type, exif }) => {
    const isValid = type === 'png' || type === 'jpg' || type === 'pdf'
    if (!isValid) return

    setLoading(true)

    // let flagUsedPagesToIncrement = false

    dataurls.forEach((src, i) => {
      const id = getNextID({
        dataurls,
        pages,
        i,
        useIncrement: false, //flagUsedPagesToIncrement,
      })
      const obj = { id, src }

      // flagUsedPagesToIncrement = true

      if (exif) obj.exif = exif

      setPages([...pages, obj])
    })

    setLoading(false)
  }

  // duplicate
  const changeTitle = async e => {
    const str = e.target.value
    setTitle(str)
  }

  // duplicate
  const changeDescription = async e => {
    const str = e.target.value
    setDescription(str)
  }

  const editSave = async ({ thresholding }) => {
    const id = props.match.params.id_document
    const _pages = thresholding ? await thresholdImages(pages) : pages

    await editDocument({
      id,
      title,
      description,
      pages: _pages,
    })

    loadDocuments()

    setScreen('')
  }

  // duplicated
  const loadDocuments = async () => {
    const documents = await getDocuments({ sortBy: 'title' })
    await dispatch(changeDocuments(documents))
  }

  // duplicated
  const editPages = async ({ type, direction, pageIndex }) => {
    const newPages =
      type === 'rotate'
        ? await _rotate({ pages, pageIndex })
        : type === 'order' && pages.length > 1
        ? changePageOrder({ pages, direction, pageIndex })
        : type === 'remove'
        ? removePage({ pages, pageIndex })
        : await thresholdPage({ pages, pageIndex })

    setPages(newPages)
  }

  return (
    <Edit
      {...props}
      id={props.match.params.id_document}
      loading={loading}
      pages={pages}
      title={title}
      description={description}
      onLoadDocuments={loadDocuments}
      onChangeTitle={changeTitle}
      onChangeDescription={changeDescription}
      onFileChange={fileChange}
      onSave={editSave}
      onEditCancel={() => setScreen('')}
      onEditPages={editPages}
    />
  )
}

export default EditContainer
