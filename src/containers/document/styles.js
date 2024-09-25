/** @type {any} */

export default {
  container: {
    width: '100vw',
    height: '100vh',
    background: '#F5F5F5',
  },
  reader: {
    transition: 'all 600ms ease 0s',
  },
  innerIMGLandscape: {
    width: '100%',
    maxWidth: '1240px', // todo: needs to be set dynamically (currently roughly A4)
  },
  back: {
    position: 'absolute',
    zIndex: '2',
    top: '10px',
    left: '10px',
  },
  prev: {
    position: 'absolute',
    left: '0',
    zIndex: '1',
    width: '100%',
    height: '50vh',
    top: '0',
  },
  next: {
    position: 'absolute',
    left: '0',
    zIndex: '1',
    width: '100%',
    height: '50vh',
    top: '50vh',
  },
}
