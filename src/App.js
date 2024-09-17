import React, { useState } from 'react'
// or `BrowserRouter as Router` to use popstate
import { HashRouter as Router, Route, Switch } from 'react-router-dom'
import Provider from 'store'

import { removeServiceWorkers } from 'utils/general'
import Button from 'components/elements/Button'

import Home from 'containers/home'
import Add from 'containers/add'
import Edit from 'containers/edit'
import Song from 'containers/song'

import { MuiThemeProvider } from '@material-ui/core/styles'

import theme from 'theme'

import polyfills from 'lib/polyfills'

polyfills()

const App = () => {
  const [showInstallBtn, setShowInstallBtn] = useState(false)

  const clickInstallNewVersion = async () => {
    await removeServiceWorkers()
    window.location.reload()
  }

  return (
    <MuiThemeProvider theme={theme}>
      <Button
        onClick={clickInstallNewVersion}
        color="primary"
        style={{
          display: showInstallBtn ? 'block' : 'none',
          position: 'absolute',
          zIndex: '999',
          background: 'red',
          bottom: '0',
          left: '0',
          margin: '15px',
          color: 'white',
        }}
      >
        New version available
      </Button>
      <Provider>
        <Router>
          <Switch>
            <Route exact path="/" component={Home} />
            <Route path="/add" component={Add} />
            <Route path="/edit/:id_song" component={Edit} />
            <Route path="/login" component={Home} />
            <Route path="/reset" component={Home} />
            <Route path="/songs/:id_song" component={Song} />
          </Switch>
        </Router>
      </Provider>
    </MuiThemeProvider>
  )
}

export default App
