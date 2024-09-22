import React, { useState } from 'react'
import { Route, Switch } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import HOC_Cropper from 'hocs/cropper'
import { setScreen } from 'utils/general'
import { getSongs, addSong, editSong } from 'utils/song'
import { thresholdImages } from 'utils/image'
import { _rotate, changePageOrder, removePage, thresholdPage, getNextID } from 'utils/add-edit'

import { changeSongs } from 'store/songs/actions'

import Add from './index.jsx'

const AddContainer = props => {
  const dispatch = useDispatch()

  const [loading, setLoading] = useState(false)
  const [pages, setPages] = useState([])
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')

  // duplicate
  const fileChange = async ({
    dataurls,
    type,
    // exif
  }) => {
    const isValid = type === 'png' || type === 'jpg' || type === 'pdf'
    if (!isValid) return

    setLoading(true)

    let flagUsedPagesToIncrement = false

    dataurls.forEach((src, i) => {
      const id = getNextID({
        dataurls,
        pages,
        i,
        useIncrement: flagUsedPagesToIncrement,
      })
      const obj = { id, src }

      flagUsedPagesToIncrement = true

      // if (exif) obj.exif = exif

      pages.push(obj)
      setPages(pages)
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

  const save = async ({ id, thresholding }) => {
    const _pages = thresholding ? await thresholdImages(pages) : pages

    if (id === 'add') {
      await addSong({
        title,
        artist,
        pages: _pages,
      })
    } else {
      await editSong({ id, title, artist, pages: _pages })
    }

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
    <Add
      {...props}
      loading={loading}
      pages={pages}
      title={title}
      artist={artist}
      onLoadSongs={loadSongs}
      onChangeTitle={changeTitle}
      onChangeArtist={changeArtist}
      onFileChange={fileChange}
      onSave={save}
      onEditPages={editPages}
      onCancel={() => setScreen('')}
    />
  )
}

const HomeRoutes = () => {
  return (
    <Switch>
      <Route path="/" component={HOC_Cropper(AddContainer)} />
    </Switch>
  )
}

export default HomeRoutes
