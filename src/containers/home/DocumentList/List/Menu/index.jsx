import React, { Fragment, useState } from 'react'
import Menu from 'components/elements/Menu'
import MenuItem from 'components/elements/MenuItem'
import { MdMoreVert as MoreVert } from 'react-icons/md'

const MenuComp = ({ document, onPopulateEditDocumentModal, onOpenDeleteModal, onExportAsPDF }) => {
  const [anchorEl, setAnchorEl] = useState(null)

  const handleClick = e => {
    setAnchorEl(e.currentTarget)
  }
  const handleClose = () => {
    setAnchorEl(null)
  }
  const _edit = () => {
    onPopulateEditDocumentModal(document.id)
    handleClose()
  }
  const _delete = () => {
    onOpenDeleteModal(document.id)
    handleClose()
  }
  const _download = () => {
    onExportAsPDF({ title: document.title, id: document.id })
    handleClose()
  }
  return (
    <Fragment>
      <div aria-controls="simple-menu" aria-haspopup="true" onClick={handleClick}>
        <MoreVert />
      </div>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose}>
        <MenuItem onClick={_edit}>Edit</MenuItem>
        <MenuItem onClick={_delete}>Delete</MenuItem>
        <MenuItem onClick={_download}>Download as PDF</MenuItem>
      </Menu>
    </Fragment>
  )
}

export default MenuComp
