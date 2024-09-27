import React from 'react'
import List from 'components/elements/List'
import ListItem from 'components/elements/ListItem'
import ListItemAvatar from 'components/elements/ListItemAvatar'
import ListItemSecondaryAction from 'components/elements/ListItemSecondaryAction'
import ListItemText from 'components/elements/ListItemText'
import Avatar from 'components/elements/Avatar'
import IconButton from 'components/elements/IconButton'
import CopioIcon from 'components/copio-icon'

import Menu from './Menu'
import styles from './styles'

const InteractiveList = props => {
  const { documents } = props
  return (
    <div style={styles.container}>
      <List dense={false}>
        {documents.map((document, i) => {
          return (
            <ListItem
              key={i}
              onClick={() => {
                props.onViewDocument(document.id)
              }}
            >
              {/* @ts-ignore */}
              <ListItemAvatar>
                <Avatar color="blue">
                  <CopioIcon />
                </Avatar>
              </ListItemAvatar>
              <ListItemText primary={document.title} secondary={document.description} />
              {/* @ts-ignore */}
              <ListItemSecondaryAction>
                <IconButton aria-label="Edit">
                  <Menu {...props} document={document} />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          )
        })}
      </List>
    </div>
  )
}

export default InteractiveList
