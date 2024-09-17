import React, { Component } from 'react'
import { getSong } from 'utils/song'
import { createPDFArray } from './utils'

export default HOC => {
  return class ReactHOC extends Component {
    constructor(props) {
      super(props)

      this.exportAsPDF = this.exportAsPDF.bind(this)

      this.state = {
        downloadPDF: {
          title: '',
          id: '',
        },
      }
    }

    async exportAsPDF({ title, id }) {
      const arr = await getSong({ id })

      const PDFArray = await createPDFArray(arr)

      this.setState({ downloadPDF: { title, id: PDFArray[0] } })

      // techdebt
      setTimeout(() => {
        document.getElementById('download').click()
      }, 100)
    }

    render() {
      return <HOC {...this.props} {...this.state} onExportAsPDF={this.exportAsPDF} />
    }
  }
}
