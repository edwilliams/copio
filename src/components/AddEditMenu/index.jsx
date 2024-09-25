import React, { Fragment, useState } from 'react'
import Menu from 'components/elements/Menu'
import MenuItem from 'components/elements/MenuItem'

import Fab from 'components/elements/Fab'
import Divider from 'components/elements/Divider'

import { MdKeyboardArrowLeft as KeyboardArrowLeft } from 'react-icons/md'
import { MdKeyboardArrowRight as KeyboardArrowRight } from 'react-icons/md'
import { MdDelete as Delete } from 'react-icons/md'
import { MdColorize as Colorize } from 'react-icons/md'
import { MdCrop as Crop } from 'react-icons/md'
import { MdEdit as Edit } from 'react-icons/md'
import { MdRotateLeft as Rotate } from 'react-icons/md'
import styles from './styles'

const AddEditMenu = ({
  pages,
  page,
  pageIndex,
  showLeftRight = true,
  onCropperOpen,
  onEditPages,
}) => {
  const [anchorEl, setAnchorEl] = useState(null)

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleCrop = () => {
    handleClose()
    onCropperOpen({ pages, pageIndex })
  }

  const handleRotate = () => {
    handleClose()
    onEditPages({ type: 'rotate', pageIndex })
  }

  const handleLeft = () => {
    handleClose()
    onEditPages({ type: 'order', direction: 'left', pageIndex })
  }

  const handleRight = () => {
    handleClose()
    onEditPages({ type: 'order', direction: 'right', pageIndex })
  }

  const handleThreshold = () => {
    handleClose()
    onEditPages({ type: 'threshold', pageIndex })
  }

  const handleDelete = () => {
    handleClose()
    onEditPages({ type: 'remove', pageIndex })
  }

  const handleClickIcon = e => {
    setAnchorEl(e.currentTarget)
  }

  const open = Boolean(anchorEl)

  return (
    <Fragment>
      <Fab style={styles.button} color="primary" onClick={handleClickIcon}>
        <Edit />
      </Fab>
      <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
        <MenuItem onClick={handleCrop}>
          <Crop />
          <p style={styles.text}>Crop</p>
        </MenuItem>

        <Divider />

        <MenuItem onClick={handleRotate}>
          <Rotate />
          <p style={styles.text}>Rotate</p>
        </MenuItem>

        {showLeftRight && <Divider />}

        {showLeftRight && (
          <MenuItem onClick={handleLeft}>
            <KeyboardArrowLeft />
            <p style={styles.text}>Left</p>
          </MenuItem>
        )}
        {showLeftRight && (
          <MenuItem onClick={handleRight}>
            <KeyboardArrowRight />
            <p style={styles.text}>Right</p>
          </MenuItem>
        )}

        <Divider />

        {!page.thresholded && (
          <div>
            <MenuItem onClick={handleThreshold}>
              <Colorize />
              <p style={styles.text}>Black &amp; White</p>
            </MenuItem>

            <Divider />
          </div>
        )}

        <MenuItem onClick={handleDelete}>
          <Delete />
          <p style={styles.text}>Delete</p>
        </MenuItem>
      </Menu>
    </Fragment>
  )
}

export default AddEditMenu
