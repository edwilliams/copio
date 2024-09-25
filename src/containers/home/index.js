import React, { useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { getScreen, setScreen } from 'utils/general'
import { getDocuments, deleteDocument } from 'utils/document'
import { changeDocuments } from 'store/documents/actions'
import { documentsSelector } from 'store/documents/selectors'
import Main from './index.jsx'

const MainContainer = props => {
  const dispatch = useDispatch()
  const documents = useSelector(documentsSelector)

  useEffect(() => {
    loadDocuments()
    const url = getScreen().includes('edit/') ? getScreen().split('edit/')[1] : ''
    if (url) populateEditDocumentModal(url)
  }, [])

  // duplicated in a HoC
  const loadDocuments = async () => {
    const documents = await getDocuments({ sortBy: 'title' })
    await dispatch(changeDocuments(documents))
  }

  const _deleteDocument = async ({ id }) => {
    await deleteDocument({ id })
    loadDocuments()
  }

  const populateEditDocumentModal = async id => {
    setScreen(`edit/${id}`)
  }

  return (
    <Main
      {...props}
      documents={documents.documents}
      onLoadDocuments={loadDocuments}
      onDeleteDocument={_deleteDocument}
      onPopulateEditDocumentModal={populateEditDocumentModal}
      onAddView={() => setScreen('add')}
    />
  )
}

export default MainContainer
