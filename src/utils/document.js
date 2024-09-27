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

export const getDocuments = async (obj = {}) => {
  const sortBy = obj.sortBy || 'title'
  const documents = await get('documents')
  return documents ? documents.sort(dynamicSort(sortBy)) : []
}

export const addDocument = async ({ id, title, description, pages }) => {
  const documents = (await get('documents')) || []
  const _id = id || uuid()

  const document = {
    id: _id,
    title,
    description,
    pages,
  }

  documents.push(document)

  await set('documents', documents)
}

export const deleteDocument = async ({ id }) => {
  const documents = await get('documents')
  await set(
    'documents',
    documents.filter(document => document.id !== id)
  )
}

export const deleteDocuments = async () => await del('documents')

export const editDocument = async ({ id, title, description, pages, ...other }) => {
  const document = await getDocument({ id })

  document.title = title
  document.description = description
  document.pages = pages

  await deleteDocument({ id })
  await addDocument({ ...document })
}

export const getDocument = async ({ id }) => {
  const documents = await get('documents')
  return documents.find(x => x.id === id)
}
