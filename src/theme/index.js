import { createMuiTheme } from '@material-ui/core/styles'

import colors from 'utils/colors'

const fontBase = [
  '-apple-system',
  'BlinkMacSystemFont',
  '"Segoe UI"',
  'Roboto',
  '"Helvetica Neue"',
  'Arial',
  'sans-serif',
  '"Apple Color Emoji"',
  '"Segoe UI Emoji"',
  '"Segoe UI Symbol"'
]

export default createMuiTheme({
  palette: {
    primary: {
      // light: will be calculated from palette.primary.main,
      main: colors.blue
      // dark: will be calculated from palette.primary.main,
      // contrastText: will be calculated to contrast with palette.primary.main
    },
    secondary: {
      main: colors.blueLighter
    }
    // error: will use the default color
  },
  typography: {
    useNextVariants: true,
    fontFamily: ['mont-regular', ...fontBase].join(','),
    h1: { fontFamily: ['mont-semibold', ...fontBase].join(',') },
    h2: { fontFamily: ['mont-semibold', ...fontBase].join(',') },
    h3: { fontFamily: ['mont-semibold', ...fontBase].join(',') },
    h4: { fontFamily: ['mont-semibold', ...fontBase].join(',') },
    h5: { fontFamily: ['mont-semibold', ...fontBase].join(',') },
    h6: { fontFamily: ['mont-semibold', ...fontBase].join(',') }
  }
})
