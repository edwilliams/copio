import React, { useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'

import { getDocuments } from 'utils/document'

import { changeDocuments } from 'store/documents/actions'
import { documentsSelector } from 'store/documents/selectors'

import Document from './index.jsx'

const DocumentContainer = props => {
  const dispatch = useDispatch()
  const documents = useSelector(documentsSelector)

  useEffect(() => {
    loadDocuments()
  }, [])

  const loadDocuments = async () => {
    const documents = await getDocuments({ sortBy: 'title' })
    await dispatch(changeDocuments(documents))
  }

  return <Document {...documents} id={props.match.params.id_document} />
}

export default DocumentContainer
