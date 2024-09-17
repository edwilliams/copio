import React from 'react'
import AppBar from 'components/elements/AppBar'
import Toolbar from 'components/elements/Toolbar'
import Typography from 'components/elements/Typography'
import { removeServiceWorkers } from 'utils/general'

import styles from './styles'

const Header = () => {
  return (
    <div style={styles.root}>
      <button
        onClick={() => removeServiceWorkers()}
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
            transform: 'translate(-16px, 3px)',
            position: 'absolute',
            opacity: '0.7',
          }}
        >
          ❌
        </span>
      </button>
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
