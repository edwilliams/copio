import React from 'react'
import CircularProgress from 'components/elements/CircularProgress'
import style from './styles'

const Loading = () => {
  return (
    <div style={style}>
      <CircularProgress />
    </div>
  )
}

export default Loading
