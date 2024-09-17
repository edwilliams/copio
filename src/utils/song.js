import { get, set, del } from 'idb-keyval'
import uuid from 'uuid/v1' // timestamp based

const dynamicSort = property => {
  let sortOrder = 1
  if (property[0] === '-') {
    sortOrder = -1
    property = property.substr(1)
  }
  return function (a, b) {
    const result = a[property] < b[property] ? -1 : a[property] > b[property] ? 1 : 0
    return result * sortOrder
  }
}

export const getSongs = async (obj = {}) => {
  const sortBy = obj.sortBy || 'title'
  const songs = await get('songs')
  return songs ? songs.sort(dynamicSort(sortBy)) : []
}

export const setSongs = async songs => {
  await set('songs', songs)
}

export const addSong = async ({
  id,
  // username,
  // devices
  title,
  artist,
  pages,
}) => {
  const songs = (await get('songs')) || []
  const _id = id || uuid()

  const song = {
    id: _id,
    // username,
    title,
    artist,
    pages,
    // devices,
    // dateLastActivity: new Date().toISOString()
  }

  songs.push(song)

  await set('songs', songs)
}

export const deleteSong = async ({ id }) => {
  const songs = await get('songs')
  await set(
    'songs',
    songs.filter(song => song.id !== id)
  )
}

export const deleteSongs = async () => await del('songs')

export const editSong = async ({ id, title, artist, pages, ...other }) => {
  const song = await getSong({ id })

  song.title = title
  song.artist = artist
  // song.dateLastActivity = new Date().toISOString()
  song.pages = pages
  // if (other.devices) song.devices = other.devices

  // delete original then re-add song
  await deleteSong({ id })
  await addSong({ ...song })
}

export const getSong = async ({ id }) => {
  const songs = await get('songs')
  return songs.find(x => x.id === id)
}
