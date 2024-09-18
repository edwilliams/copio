import React from 'react'
import AppBar from 'components/elements/AppBar'
import Toolbar from 'components/elements/Toolbar'
import Typography from 'components/elements/Typography'
import { removeServiceWorkers } from 'utils/general'
import { deleteSongs } from 'utils/song'

import styles from './styles'

const Uninstall = () => (
  <button
    onClick={() => {
      const remove = confirm(
        'Do you want to uninstall COPIO? This will remove local files and user data.'
      )
      if (remove) {
        removeServiceWorkers()
        deleteSongs()
        window.location.reload()
      }
    }}
    title="uninstall"
    style={{
      position: 'absolute',
      padding: '8px',
      cursor: 'pointer',
      zIndex: '999',
    }}
  >
    <span>💾</span>
    <span
      style={{
        position: 'absolute',
        top: '12px',
        left: '8px',
        opacity: '0.7',
      }}
    >
      ❌
    </span>
  </button>
)

const Header = () => {
  return (
    <div style={styles.root}>
      <Uninstall />
      <AppBar position="static">
        <Toolbar>
          <Typography style={styles.title} variant="h6" color="inherit" noWrap>
            COPIO
          </Typography>
        </Toolbar>
      </AppBar>
    </div>
  )
}

export default Header
