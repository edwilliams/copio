import React from 'react'
// import PropTypes from 'prop-types'
import Paper from 'components/elements/Paper'
import Tabs from 'components/elements/Tabs'
import Tab from 'components/elements/Tab'

class CenteredTabs extends React.Component {
  render() {
    return (
      <Paper>
        <Tabs
          value={'title'}
          onChange={(e, str) => {
            this.props.onSwitchSongListing(str)
          }}
          indicatorColor="primary"
          textColor="primary"
          centered
        >
          <Tab value="title" label="Title" />
          <Tab value="artist" label="Artist" />
        </Tabs>
      </Paper>
    )
  }
}

// CenteredTabs.propTypes = {}

export default CenteredTabs
