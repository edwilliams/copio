import React from 'react'
import PropTypes from 'prop-types'
import Card from 'components/elements/Card'
import CardContent from 'components/elements/CardContent'
import Typography from 'components/elements/Typography'
import Tabs from './Tabs'
import Header from 'components/Header'
import Fab from 'components/elements/Fab'
import { MdPhotoCamera as PhotoCamera } from 'react-icons/md'

import SongList from './SongList'

const styles = {
  card: {
    textAlign: 'center',
    margin: '15px',
  },
}

const Main = props => {
  const { songs, downloadPDF, onSwitchSongListing } = props
  const { title, id } = downloadPDF

  return (
    <article>
      <Header />

      <Tabs onSwitchSongListing={onSwitchSongListing} />

      {songs.length > 0 ? (
        <SongList {...props} songs={songs} />
      ) : (
        <Card style={styles.card}>
          <CardContent>
            <Typography variant="h5" component="h2">
              You have no songs
            </Typography>
            <Typography component="p">Tap the camera icon below to add a song.</Typography>
          </CardContent>
        </Card>
      )}

      <div className="abr mbl mrl">
        <Fab color="primary" onClick={props.onAddView}>
          <PhotoCamera size="2em" />
        </Fab>
      </div>

      {/* todo: dynamically generate this anchor? */}
      <a id="download" href={id} download={title}></a>
    </article>
  )
}

Main.propTypes = {
  listing: PropTypes.string,
  songs: PropTypes.array,
  onSwitchSongListing: PropTypes.func,
  onAddEditView: PropTypes.func,
}

export default Main
