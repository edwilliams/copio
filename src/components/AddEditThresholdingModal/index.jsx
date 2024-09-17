import React from 'react'

import Button from 'components/elements/Button'
import Dialog from 'components/elements/Dialog'

class Modal extends React.Component {
  render() {
    const { loading, dialogImageProcessOpen } = this.props

    return (
      <Dialog
        title="Thresholding"
        modal={false}
        open={dialogImageProcessOpen}
        actions={[
          <Button
            label="No"
            primary
            onClick={() => {
              this.props.onSave({ thresholding: false })
            }}
          />,
          <Button
            label="Yes"
            primary
            keyboardFocused
            onClick={() => {
              this.props.onSave({ thresholding: true })
            }}
          />
        ]}
      >
        <p>Would you like all images to be processed as black and white?</p>
        {loading && (
          <p>Please note: screen may freeze temporarily while image is uploaded and processed</p>
        )}
      </Dialog>
    )
  }
}

export default Modal
