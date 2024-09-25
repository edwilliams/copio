import { CHANGE_DOCUMENTS } from './actionTypes'

export const changeDocuments = data => ({
  type: CHANGE_DOCUMENTS,
  payload: data,
})
