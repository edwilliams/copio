import React, { useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'

import { getSongs } from 'utils/song'

import { changeSongs } from 'store/songs/actions'
import { songsSelector } from 'store/songs/selectors'

import Song from './index.jsx'

const SongContainer = props => {
  const dispatch = useDispatch()
  const songs = useSelector(songsSelector)

  useEffect(() => {
    loadSongs()
  }, [])

  const loadSongs = async () => {
    const songs = await getSongs({ sortBy: 'title' })
    await dispatch(changeSongs(songs))
  }

  return <Song {...songs} id={props.match.params.id_song} />
}

export default SongContainer
