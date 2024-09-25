/** @type {any} */

export default {
  textFieldContainer: {
    margin: '85px 0 0 15px',
  },
  textFieldTitle: {
    marginRight: '15px',
  },
  button: {
    position: 'absolute',
    right: '0',
  },
  images: {
    display: 'grid',
    gridTemplate: 'repeat(3, 1fr) / repeat(3, 1fr)',
    gap: '15px 15px',
    padding: '15px',
  },
  imageItem: {
    position: 'relative',
    cursor: '-webkit-grab',
  },
  imageItemIMG: {
    width: '100%',
    boxShadow:
      '0px 3px 5px -1px rgba(0,0,0,0.2), 0px 6px 10px 0px rgba(0,0,0,0.14), 0px 1px 18px 0px rgba(0,0,0,0.12)',
  },
  fileInputWrapper: {
    position: 'fixed',
    bottom: '15px',
    right: '15px',
    zIndex: '1',
  },
}
