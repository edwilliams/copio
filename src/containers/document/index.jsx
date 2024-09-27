import React, { useState, useRef } from 'react'
import useEventListener from '@use-it/event-listener'
import Fab from 'components/elements/Fab'
import { MdKeyboardBackspace as KeyboardBackspace } from 'react-icons/md'
import { setScreen } from 'utils/general'

import styles from './styles'

const IMGHEIGHT = 1754

const Document = ({ documents = [], id }) => {
  const reader = useRef()

  const [index, setIndex] = useState(0)

  // @ts-ignore
  useEventListener('keydown', ({ key }) => {
    if (key === 'ArrowLeft') prev()
    if (key === 'ArrowRight') next()
  })

  const prev = () => {
    if (index > 0) setIndex(index - 1)
  }

  const next = () => {
    // todo: make this correct
    // const document = documents.find(document => id === document.id) || { pages: [] }
    // const bool =
    //   IMGHEIGHT * document.pages.length > index * window.innerHeight + IMGHEIGHT //* 2
    // if (bool) setIndex(index + 1)
    setIndex(index + 1)
  }

  const document = documents.find(document => id === document.id) || {}

  let _pages = document.pages || []

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
        // @ts-ignore
        ref={reader}
        style={{
          ...styles.reader,
          transform: `translate3d(0, -${yAxis}px, 0)`,
        }}
      >
        {document && (
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

        {document && <div className="reader-pagination"></div>}
      </div>

      <div onClick={prev} style={styles.prev}></div>
      <div onClick={next} style={styles.next}></div>
    </article>
  )
}

export default Document
