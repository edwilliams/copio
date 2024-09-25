import React, { useState } from 'react'

import List from './List'
import DialogDelete from './DialogDelete'

import { setScreen } from 'utils/general'

const DocumentList = props => {
  const [modalOpen, setModalOpen] = useState(false)
  const [idToDelete, setIdToDelete] = useState('')

  const viewDocument = id => {
    setScreen(`document/${id}`)
  }

  const openDeleteModal = id => {
    setModalOpen(true)
    setIdToDelete(id)
  }

  const deleteDocumentModal = async () => {
    await props.onDeleteDocument({ id: idToDelete })
    props.onLoadDocuments()
    setModalOpen(false)
  }

  const exportAsPDF = async ({ title, id }) => {
    await props.exportAsPDF({ title, id })
    setModalOpen(false)
  }

  const closeDeleteModal = () => {
    setModalOpen(false)
  }

  return (
    <>
      <List
        {...props}
        onViewDocument={viewDocument}
        onOpenDeleteModal={openDeleteModal}
        onExportAsPDF={exportAsPDF}
      />

      <DialogDelete
        open={modalOpen}
        onCloseDeleteModal={closeDeleteModal}
        onDeleteDocumentModal={deleteDocumentModal}
      />
    </>
  )
}

export default DocumentList
