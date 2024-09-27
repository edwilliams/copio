import React, { useRef } from 'react'

import useCropper from 'hooks/useCropper'

import Button from 'components/elements/Button'
import Dialog from 'components/elements/Dialog'
import AppBar from 'components/elements/AppBar'
import Toolbar from 'components/elements/Toolbar'
import IconButton from 'components/elements/IconButton'
import Typography from 'components/elements/Typography'
import { MdClose as Close } from 'react-icons/md'
import TextField from 'components/elements/TextField'
import DialogActions from 'components/elements/DialogActions'
import DialogContent from 'components/elements/DialogContent'
import DialogTitle from 'components/elements/DialogTitle'
import FileInput from 'components/FileInput'
import AddEditMenu from 'components/AddEditMenu'
import styles from './styles'

// lots of duplication between add / edit
const Add = ({
  title,
  description,
  pages,
  onSave,
  onCancel,
  onChangeTitle,
  onChangeDescription,
  onFileChange,
  onEditPages,
}) => {
  const images = useRef()

  const { dialogCropperOpen, cropperOpen, cropperCancel, cropperSave } = useCropper()

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
              Add new document
            </Typography>
            <Button
              color="inherit"
              disabled={title === '' || description === ''}
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
            label="Enter Description"
            margin="normal"
            variant="outlined"
            value={description}
            onChange={onChangeDescription}
          />
        </div>

        <div style={styles.fileInputWrapper}>
          {/* @ts-ignore */}
          <FileInput onFileChange={onFileChange} />
        </div>

        {/* @ts-ignore */}
        <div style={styles.images} ref={images}>
          {pages.map((page, i) => (
            <div key={i} style={styles.imageItem}>
              <AddEditMenu
                showLeftRight={pages.length > 1}
                pages={pages}
                pageIndex={i}
                page={page}
                onEditPages={onEditPages}
                onCropperOpen={cropperOpen}
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
            <Button onClick={cropperCancel} color="primary">
              Cancel
            </Button>
            <Button
              onClick={() => {
                cropperSave({ pages })
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
