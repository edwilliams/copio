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
    // height: '100%',
    width: '100%',
    // objectFit: 'cover',
    // objectPosition: '0 0',
    maxWidth: '1240px', // todo: needs to be set dynamically (currently roughly A4)
  },
  back: {
    position: 'absolute',
    zIndex: '2',
    top: '10px',
    left: '10px',
  },
  // todo: pagination
  // nav: {
  //   width: '130px',
  //   background: 'green',
  //   position: 'absolute',
  //   zIndex: '2',
  //   top: '0',
  //   height: '100%',
  //   display: 'flex',
  //   justifyContent: 'center',
  //   alignItems: 'center'
  // },
  // navItem: {
  //   background: 'red',
  //   borderRadius: '100%',
  //   width: '50px',
  //   height: '50px'
  // },
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
