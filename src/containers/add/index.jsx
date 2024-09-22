import React, { useRef } from 'react'
import Button from 'components/elements/Button'
import Dialog from 'components/elements/Dialog'
import AppBar from 'components/elements/AppBar'
import Toolbar from 'components/elements/Toolbar'
import IconButton from 'components/elements/IconButton'
import Typography from 'components/elements/Typography'
import CardContent from 'components/elements/CardContent'
import { MdClose as Close } from 'react-icons/md'
import TextField from 'components/elements/TextField'
import DialogActions from 'components/elements/DialogActions'
import DialogContent from 'components/elements/DialogContent'
import DialogTitle from 'components/elements/DialogTitle'
import FileInput from 'components/FileInput'
import Menu from 'components/AddEditMenu'
import styles from './styles'

// lots of duplication between add / edit
const Add = ({
  title,
  artist,
  dialogCropperOpen,
  pages,
  onSave,
  onCancel,
  onChangeTitle,
  onChangeArtist,
  onFileChange,
  onCropperCancel,
  onCropperSave,
  onEditPages,
  onCropperOpen,
}) => {
  const images = useRef()

  const addEditSave = async ({ thresholding }) => {
    await onSave({ id: 'add', thresholding })
  }

  return (
    <article className="addedit-container">
      <Dialog fullScreen open={true} onClose={onCancel}>
        <AppBar style={styles.appBar}>
          <Toolbar>
            <IconButton color="inherit" onClick={onCancel} aria-label="Close">
              <Close />
            </IconButton>
            <Typography variant="h6" color="inherit" style={styles.flex}>
              Add new song
            </Typography>
            <Button
              color="inherit"
              disabled={title === '' || artist === ''}
              style={styles.button}
              onClick={() => {
                addEditSave({ thresholding: false })
              }}
            >
              save
            </Button>
          </Toolbar>
        </AppBar>

        <div style={styles.textFieldContainer}>
          <TextField
            label="Enter Title"
            margin="normal"
            variant="outlined"
            value={title}
            style={styles.textFieldTitle}
            onChange={onChangeTitle}
          />

          <TextField
            label="Enter Artist"
            margin="normal"
            variant="outlined"
            value={artist}
            onChange={onChangeArtist}
          />
        </div>

        <div style={styles.fileInputWrapper}>
          <FileInput id="file-input" onFileChange={onFileChange} />
        </div>

        <div style={styles.images} ref={images}>
          {pages.map((page, i) => (
            <div key={i} style={styles.imageItem}>
              <Menu
                pages={pages}
                pageIndex={i}
                page={page}
                onEditPages={onEditPages}
                onCropperOpen={onCropperOpen}
              />

              <div className="addedit-image-img">
                <img id={`addedit-image-img-${i}`} style={styles.imageItemIMG} src={page.src} />
              </div>
            </div>
          ))}
        </div>

        <Dialog open={dialogCropperOpen} onClose={() => {}}>
          <DialogTitle>Crop Image</DialogTitle>
          <DialogContent>
            <img id="image-to-edit" src="" />
          </DialogContent>
          <DialogActions>
            <Button onClick={onCropperCancel} color="primary">
              Cancel
            </Button>
            <Button
              onClick={() => {
                onCropperSave({ pages })
              }}
              color="primary"
              autoFocus
            >
              Save
            </Button>
          </DialogActions>
        </Dialog>
      </Dialog>
    </article>
  )
}

export default Add
