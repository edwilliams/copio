import { CHANGE_SONGS } from './actionTypes'

export const changeSongs = data => ({
  type: CHANGE_SONGS,
  payload: data,
})
