import React from 'react'
import Cropper from 'cropperjs'

let cropper = {}

export default HOC => {
  return class ReactHOC extends React.Component {
    constructor(props) {
      super(props)

      this.cropperOpen = this.cropperOpen.bind(this)
      this.cropperCancel = this.cropperCancel.bind(this)
      this.cropperSave = this.cropperSave.bind(this)

      this.state = {
        dialogCropperOpen: false,
        pageIndex: 0,
      }
    }

    cropperOpen({ pages, pageIndex }) {
      this.setState({ pageIndex, dialogCropperOpen: true })

      // NB an empty image in the DOM will be given a dataurl from state
      // but isn't currently present in DOM as hidden inside a Edit Dialog Modal
      setTimeout(() => {
        const el = document.getElementById('image-to-edit')
        const dataurl = pages[pageIndex].src
        el.setAttribute('src', dataurl)

        cropper = new Cropper(el, {
          aspectRatio: 1 / 1.414,
        })
      }, 100)
    }

    cropperCancel() {
      this.setState({ dialogCropperOpen: false })
    }

    cropperSave({ pages }) {
      const newPages = [...pages]
      // NB: think this is always to dataurl as png, not jpg (more research needed)
      newPages[this.state.pageIndex].src = cropper.getCroppedCanvas().toDataURL('image/png')
      this.setState({ pages: newPages, dialogCropperOpen: false })
    }

    render() {
      return (
        <HOC
          {...this.props}
          dialogCropperOpen={this.state.dialogCropperOpen}
          onCropperOpen={this.cropperOpen}
          onCropperCancel={this.cropperCancel}
          onCropperSave={this.cropperSave}
        />
      )
    }
  }
}
