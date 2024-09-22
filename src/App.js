import React from 'react'
// or `BrowserRouter as Router` to use popstate
import { HashRouter as Router, Route, Switch } from 'react-router-dom'
import Provider from 'store'
import Home from 'containers/home'
import Add from 'containers/add'
import Edit from 'containers/edit'
import Song from 'containers/song'

import { MuiThemeProvider } from '@material-ui/core/styles'

import theme from 'theme'

const App = () => (
  <MuiThemeProvider theme={theme}>
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

export default App
