import React, { useState } from 'react'

import List from './List'
import DialogDelete from './DialogDelete'

import { setScreen } from 'utils/general'

const SongList = props => {
  const [modalOpen, setModalOpen] = useState(false)
  const [idToDelete, setIdToDelete] = useState('')

  const viewSong = id => {
    setScreen(`songs/${id}`)
  }

  const openDeleteModal = id => {
    setModalOpen(true)
    setIdToDelete(id)
  }

  const deleteSongModal = async () => {
    await onDeleteSong({ id: idToDelete })
    onLoadSongs()
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
        onViewSong={viewSong}
        onOpenDeleteModal={openDeleteModal}
        onExportAsPDF={exportAsPDF}
      />

      <DialogDelete
        open={modalOpen}
        onCloseDeleteModal={closeDeleteModal}
        onDeleteSongModal={deleteSongModal}
      />
    </>
  )
}

export default SongList
