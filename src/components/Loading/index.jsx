import React from 'react'
import CircularProgress from 'components/elements/CircularProgress'

const Loading = () => {
  const style = {
    background: 'rgba(255,255,255,0.75)',
    position: 'absolute',
    top: '0',
    width: '100%',
    height: '100%',
    left: '0',
    zIndex: '2',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center'
  }
  return (
    <div style={style}>
      <CircularProgress />
    </div>
  )
}

export default Loading
