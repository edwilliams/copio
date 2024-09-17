import React from 'react'
import Button from 'components/elements/Button'
import Dialog from 'components/elements/Dialog'
import DialogActions from 'components/elements/DialogActions'
import DialogContent from 'components/elements/DialogContent'
import DialogContentText from 'components/elements/DialogContentText'
import DialogTitle from 'components/elements/DialogTitle'

class AlertDialog extends React.Component {
  render() {
    return (
      <Dialog open={this.props.open} onClose={this.handleClose}>
        <DialogTitle>Delete Song?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Would you like to remove this song from your library?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={this.props.onCloseDeleteModal} color="primary">
            Cancel
          </Button>
          <Button onClick={this.props.onDeleteSongModal} color="primary" autoFocus>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    )
  }
}

export default AlertDialog
