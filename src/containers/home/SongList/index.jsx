import React, { Component } from 'react'

import List from './List'
import DialogDelete from './DialogDelete'

import { setScreen } from 'utils/general'

class SongList extends Component {
  constructor(props) {
    super(props)

    this.viewSong = this.viewSong.bind(this)
    this.openDeleteModal = this.openDeleteModal.bind(this)
    this.deleteSongModal = this.deleteSongModal.bind(this)
    this.exportAsPDF = this.exportAsPDF.bind(this)
    this.closeDeleteModal = this.closeDeleteModal.bind(this)

    this.state = {
      modalOpen: false,
      idToDelete: ''
    }
  }

  viewSong(id) {
    setScreen(`songs/${id}`)
  }

  openDeleteModal(id) {
    this.setState({ modalOpen: true, idToDelete: id })
  }

  async deleteSongModal() {
    await this.props.onDeleteSong({ id: this.state.idToDelete })
    this.props.onLoadSongs()
    this.setState({ modalOpen: false })
  }

  async exportAsPDF({ title, id }) {
    await this.props.onExportAsPDF({ title, id })
    this.setState({ modalOpen: false })
  }

  closeDeleteModal() {
    this.setState({ modalOpen: false })
  }

  render() {
    return (
      <React.Fragment>
        <List
          {...this.props}
          onViewSong={this.viewSong}
          onOpenDeleteModal={this.openDeleteModal}
          onExportAsPDF={this.exportAsPDF}
        />

        <DialogDelete
          open={this.state.modalOpen}
          onCloseDeleteModal={this.closeDeleteModal}
          onDeleteSongModal={this.deleteSongModal}
        />
      </React.Fragment>
    )
  }
}

export default SongList
