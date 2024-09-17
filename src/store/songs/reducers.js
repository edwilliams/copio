import { CHANGE_SONGS } from './actionTypes'

const initialState = {
  songs: [],
}

// todo: look into using immer
export default (state = initialState, action) => {
  switch (action.type) {
    case CHANGE_SONGS:
      return { ...state, songs: action.payload }
    default:
      return state
  }
}
