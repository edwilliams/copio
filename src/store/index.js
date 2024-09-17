import React from 'react'
import { Provider as ReactReduxProvider } from 'react-redux'
import { createStore } from 'redux'
import reducers from './reducers'

export default ({ children }) => {
  const store = createStore(reducers)

  if (process.env.NODE_ENV === 'development') window.store = store.getState

  return <ReactReduxProvider store={store}>{children}</ReactReduxProvider>
}
