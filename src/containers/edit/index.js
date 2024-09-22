import React, { useState, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { setScreen } from 'utils/general'
import { getSongs, getSong, editSong } from 'utils/song'
import { thresholdImages } from 'utils/image'
import { _rotate, changePageOrder, removePage, thresholdPage, getNextID } from 'utils/add-edit'

import { changeSongs } from 'store/songs/actions'

import Edit from './index.jsx'

// techdebt: in fileChange pages is empty, despite being populated in return
let PAGES = []

// function dataURLtoFile(dataurl, filename) {
//   var arr = dataurl.split(','),
//     mime = arr[0].match(/:(.*?);/)[1],
//     bstr = atob(arr[arr.length - 1]),
//     n = bstr.length,
//     u8arr = new Uint8Array(n)
//   while (n--) {
//     u8arr[n] = bstr.charCodeAt(n)
//   }
//   return new File([u8arr], filename, { type: mime })
// }

const EditContainer = props => {
  const dispatch = useDispatch()

  const [loading, setLoading] = useState(false)
  const [pages, setPages] = useState([])
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')

  useEffect(() => {
    const id = props.match.params.id_song
    init(id)
  }, [])

  const init = async id => {
    const song = await getSong({ id })

    setTitle(song.title)
    setArtist(song.artist)
    setPages(song.pages)
    PAGES = song.pages
  }

  // duplicate
  const fileChange = async ({ name, dataurls, type, exif }) => {
    const isValid = type === 'png' || type === 'jpg' || type === 'pdf'
    if (!isValid) return

    setLoading(true)

    let flagUsedPagesToIncrement = false

    dataurls.forEach((src, i) => {
      const id = getNextID({
        dataurls,
        pages: PAGES,
        i,
        useIncrement: flagUsedPagesToIncrement,
      })
      const obj = { id, src }

      flagUsedPagesToIncrement = true

      if (exif) obj.exif = exif

      PAGES.push(obj)
      setPages(PAGES)
    })

    setLoading(false)
  }

  // duplicate
  const changeTitle = async e => {
    const str = e.target.value
    setTitle(str)
  }

  // duplicate
  const changeArtist = async e => {
    const str = e.target.value
    setArtist(str)
  }

  const editSave = async ({ thresholding }) => {
    const id = props.match.params.id_song
    const _pages = thresholding ? await thresholdImages(pages) : pages

    await editSong({
      id,
      title,
      artist,
      pages: _pages,
    })

    loadSongs()

    setScreen('')
  }

  // duplicated
  const loadSongs = async () => {
    const songs = await getSongs({ sortBy: 'title' })
    await dispatch(changeSongs(songs))
  }

  // duplicated
  const editPages = async ({ type, direction, pageIndex }) => {
    const newPages =
      type === 'rotate'
        ? await _rotate({ pages, pageIndex })
        : type === 'order' && pages.length > 1
        ? changePageOrder({ pages, direction, pageIndex })
        : type === 'remove'
        ? removePage({ pages, pageIndex })
        : await thresholdPage({ pages, pageIndex })

    setPages(newPages)
  }

  return (
    <Edit
      {...props}
      id={props.match.params.id_song}
      loading={loading}
      pages={pages}
      title={title}
      artist={artist}
      onLoadSongs={loadSongs}
      onChangeTitle={changeTitle}
      onChangeArtist={changeArtist}
      onFileChange={fileChange}
      onSave={editSave}
      onEditCancel={() => setScreen('')}
      onEditPages={editPages}
    />
  )
}

export default EditContainer
