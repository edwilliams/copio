import React, { useState, useRef } from 'react'
import PropTypes from 'prop-types'
import useEventListener from '@use-it/event-listener'
import Fab from 'components/elements/Fab'
import { MdKeyboardBackspace as KeyboardBackspace } from 'react-icons/md'
import { setScreen } from 'utils/general'

import styles from './styles'

const IMGHEIGHT = 1754

const Song = ({ songs = [], id }) => {
  const reader = useRef()

  const [index, setIndex] = useState(0)

  useEventListener('keydown', ({ key }) => {
    if (key === 'ArrowLeft') prev()
    if (key === 'ArrowRight') next()
  })

  const prev = () => {
    if (index > 0) setIndex(index - 1)
  }

  const next = () => {
    // todo: make this correct
    // const song = songs.find(song => id === song.id) || { pages: [] }
    // const bool =
    //   IMGHEIGHT * song.pages.length > index * window.innerHeight + IMGHEIGHT //* 2
    // if (bool) setIndex(index + 1)
    setIndex(index + 1)
  }

  const song = songs.find(song => id === song.id) || {}

  let _pages = song.pages || []

  // todo: the last figure should be less, resulting in the last page finishing at the bottom of the screen
  // i.e. (pageHeight * numberOfPages) - (index * window.innerHeight)
  const yAxis =
    index === 0 ? index * window.innerHeight : index * window.innerHeight - index * (IMGHEIGHT / 4)

  return (
    <article style={styles.container}>
      <Fab
        style={styles.back}
        color="primary"
        onClick={() => {
          setScreen('')
        }}
      >
        <KeyboardBackspace />
      </Fab>

      <div
        ref={reader}
        style={{
          ...styles.reader,
          transform: `translate3d(0, -${yAxis}px, 0)`,
        }}
      >
        {song && (
          <React.Fragment>
            {_pages.map((page, i) => {
              return (
                <div key={i} style={{ textAlign: 'center' }}>
                  <img style={styles.innerIMGLandscape} src={page.src} />
                </div>
              )
            })}
          </React.Fragment>
        )}

        {song && <div className="reader-pagination"></div>}
      </div>

      <div onClick={prev} style={styles.prev}></div>
      <div onClick={next} style={styles.next}></div>
    </article>
  )
}

Song.propTypes = {
  id: PropTypes.string,
  songs: PropTypes.array,
}

export default Song
