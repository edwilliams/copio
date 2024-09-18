import React, { useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import HOC_ExportAsPDF from './hocs/exportAsPDF' // todo: resolve issues with parceljs
import { getScreen, setScreen } from 'utils/general'
import { getSongs, deleteSong } from 'utils/song'
import { changeSongs } from 'store/songs/actions'
import { songsSelector } from 'store/songs/selectors'
import Main from './index.jsx'

const MainContainer = props => {
  const dispatch = useDispatch()
  const songs = useSelector(songsSelector)

  useEffect(() => {
    loadSongs()
    const url = getScreen().includes('edit/') ? getScreen().split('edit/')[1] : ''
    if (url) populateEditSongModal(url)
  }, [])

  // duplicated in a HoC
  const loadSongs = async () => {
    const songs = await getSongs({ sortBy: 'title' })
    await dispatch(changeSongs(songs))
  }

  const _deleteSong = async ({ id }) => {
    await deleteSong({ id })
    loadSongs()
  }

  const populateEditSongModal = async id => {
    setScreen(`edit/${id}`)
  }

  return (
    <Main
      {...props}
      songs={songs.songs}
      onLoadSongs={loadSongs}
      onToggleRegisterSubscribeModal={() => {}}
      onDeleteSong={_deleteSong}
      onPopulateEditSongModal={populateEditSongModal}
      onSearch={() => {}}
      onChangeEmail={() => {}}
      onAddView={() => setScreen('add')}
    />
  )
}

export default HOC_ExportAsPDF(MainContainer) // HomeRoutes
