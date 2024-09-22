const path = require('path')
const webpack = require('webpack')
const htmlWebpackPlugin = require('html-webpack-plugin')
const Dotenv = require('dotenv-webpack')

module.exports = {
  output: {
    filename: 'app.min.js',
  },
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        },
      },
      {
        test: /\.html$/,
        use: [
          {
            loader: 'html-loader',
          },
        ],
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.jsx'],
    alias: {
      api: path.resolve(__dirname, `src/api/`),
      components: path.resolve(__dirname, `src/components/`),
      config: path.resolve(__dirname, `src/config/`),
      containers: path.resolve(__dirname, `src/containers/`),
      hooks: path.resolve(__dirname, `src/hooks/`),
      lib: path.resolve(__dirname, `src/lib/`),
      store: path.resolve(__dirname, `src/store/`),
      theme: path.resolve(__dirname, `src/theme/`),
      utils: path.resolve(__dirname, `src/utils/`),
    },
  },
  devServer: {
    contentBase: 'public',
  },
  plugins: [
    new Dotenv(),
    new webpack.DefinePlugin({
      VERSION: JSON.stringify(require('./package.json').version),
    }),
    new htmlWebpackPlugin({
      isDevelopment: process.env.WEBPACK_DEV_SERVER
        ? JSON.parse(process.env.WEBPACK_DEV_SERVER)
        : false,
      template: './src/index.ejs',
      filename: './index.html',
    }),
  ],
}
