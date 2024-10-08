/** @type {any} */

export default {
  root: {
    width: '100%',
  },
  grow: {
    flexGrow: 1,
  },
  menuButton: {
    marginLeft: -12,
    marginRight: 20,
  },
  title: {
    textAlign: 'center',
    width: '100%',
  },
  search: {
    position: 'relative',
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginLeft: 0,
    width: '100%',
  },
  searchIcon: {
    width: 72,
    height: '100%',
    position: 'absolute',
    pointerEvents: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputInput: {
    color: 'inherit',
    width: '100%',
    paddingTop: 8,
    paddingRight: 8,
    paddingBottom: 8,
    paddingLeft: 80,
    transition: 'width 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
  },
  uninstall: {
    button: {
      position: 'absolute',
      padding: '8px',
      cursor: 'pointer',
      zIndex: '999',
    },
    cross: {
      position: 'absolute',
      top: '12px',
      left: '8px',
      opacity: '0.7',
    },
  },
}
