import React from 'react'
import { MdPhotoCamera as PhotoCamera } from 'react-icons/md'

import useExportAsPDF from 'hooks/useExportAsPDF'

import Card from 'components/elements/Card'
import CardContent from 'components/elements/CardContent'
import Typography from 'components/elements/Typography'
import Header from 'components/Header'
import Fab from 'components/elements/Fab'

import DocumentList from './DocumentList'

import styles from './styles'

const Main = props => {
  const { downloadPDF, exportAsPDF } = useExportAsPDF()

  return (
    <article>
      <Header />

      {props.documents.length > 0 ? (
        <DocumentList {...props} documents={props.documents} exportAsPDF={exportAsPDF} />
      ) : (
        <Card style={styles.card}>
          <CardContent>
            <Typography component="p">
              Tap the <PhotoCamera size="1em" style={{ transform: 'translateY(2px)' }} /> icon below
              to add an image / document.
            </Typography>
          </CardContent>
        </Card>
      )}

      <div className="abr mbl mrl">
        <Fab color="primary" onClick={props.onAddView}>
          <PhotoCamera size="2em" />
        </Fab>
      </div>

      <a id="download" href={downloadPDF.id} download={downloadPDF.title}></a>
    </article>
  )
}

export default Main
