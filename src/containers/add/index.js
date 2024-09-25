import React, { useState } from 'react'
import { Route, Switch } from 'react-router-dom'
import { useDispatch } from 'react-redux'
// import HOC_Cropper from 'hocs/cropper'
import { setScreen } from 'utils/general'
import { getDocuments, addDocument, editDocument } from 'utils/document'
import { thresholdImages } from 'utils/image'
import { _rotate, changePageOrder, removePage, thresholdPage, getNextID } from 'utils/add-edit'

import { changeDocuments } from 'store/documents/actions'

import Add from './index.jsx'

const AddContainer = props => {
  const dispatch = useDispatch()

  const [loading, setLoading] = useState(false)
  const [pages, setPages] = useState([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  // duplicate
  const fileChange = async ({
    dataurls,
    type,
    // exif
  }) => {
    const isValid = type === 'png' || type === 'jpg' || type === 'pdf'
    if (!isValid) return

    setLoading(true)

    let flagUsedPagesToIncrement = false

    dataurls.forEach((src, i) => {
      const id = getNextID({
        dataurls,
        pages,
        i,
        useIncrement: flagUsedPagesToIncrement,
      })
      const obj = { id, src }

      flagUsedPagesToIncrement = true

      // if (exif) obj.exif = exif

      pages.push(obj)
      setPages(pages)
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

  const save = async ({ id, thresholding }) => {
    const _pages = thresholding ? await thresholdImages(pages) : pages

    if (id === 'add') {
      await addDocument({
        title,
        description,
        pages: _pages,
      })
    } else {
      await editDocument({ id, title, description, pages: _pages })
    }

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
    <Add
      {...props}
      loading={loading}
      pages={pages}
      title={title}
      description={description}
      onLoadDocuments={loadDocuments}
      onChangeTitle={changeTitle}
      onChangeDescription={changeDescription}
      onFileChange={fileChange}
      onSave={save}
      onEditPages={editPages}
      onCancel={() => setScreen('')}
    />
  )
}

const HomeRoutes = () => {
  return (
    <Switch>
      <Route path="/" component={AddContainer} />
    </Switch>
  )
}

export default HomeRoutes
