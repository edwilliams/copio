import React from 'react'
import PropTypes from 'prop-types'
import { MdPhotoCamera as PhotoCamera } from 'react-icons/md'

import useExportAsPDF from './useExportAsPDF'

import Card from 'components/elements/Card'
import CardContent from 'components/elements/CardContent'
import Typography from 'components/elements/Typography'
import Header from 'components/Header'
import Fab from 'components/elements/Fab'

import SongList from './SongList'

const styles = {
  card: {
    textAlign: 'center',
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    padding: '20px 10px 10px 10px',
  },
}

const Main = props => {
  const { downloadPDF, exportAsPDF } = useExportAsPDF()

  return (
    <article>
      <Header />

      {props.songs.length > 0 ? (
        <SongList {...props} songs={props.songs} exportAsPDF={exportAsPDF} />
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

Main.propTypes = {
  listing: PropTypes.string,
  songs: PropTypes.array,
  onAddEditView: PropTypes.func,
}

export default Main
