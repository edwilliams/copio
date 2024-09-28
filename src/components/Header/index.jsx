import React from 'react'
import AppBar from 'components/elements/AppBar'
import Toolbar from 'components/elements/Toolbar'
import Typography from 'components/elements/Typography'
import { removeServiceWorkers } from 'utils/general'
import { deleteDocuments } from 'utils/document'

import styles from './styles'

const Uninstall = () => (
  <button
    onClick={async () => {
      const remove = confirm(
        'Do you want to uninstall COPIO? This will remove local files and user data.'
      )
      if (remove) {
        await removeServiceWorkers()
        deleteDocuments()
        window.location.reload()
      }
    }}
    title="uninstall"
    style={styles.uninstall.button}
  >
    <span>💾</span>
    <span style={styles.uninstall.cross}>❌</span>
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
