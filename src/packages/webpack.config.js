/*
 * Builds the local OS.js packages in this folder into <package>/dist,
 * where `osjs-cli package:discover` picks them up.
 *
 *   ModernTheme  - desktop theme (main.js + main.css)
 *   Textpad      - Textpad with zoom; replaces the npm version
 *
 * ModernIcons has no code; it is built by ModernIcons/build.js.
 */
const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const mode = process.env.NODE_ENV || 'development';

const createConfig = (name, copy = []) => ({
  mode,
  devtool: 'source-map',
  context: path.resolve(__dirname, name),
  entry: {
    main: path.resolve(__dirname, name, 'index.js')
  },
  output: {
    path: path.resolve(__dirname, name, 'dist'),
    filename: '[name].js'
  },
  externals: {
    osjs: 'OSjs'
  },
  optimization: {
    minimize: mode === 'production'
  },
  plugins: [
    new MiniCssExtractPlugin({filename: '[name].css'}),
    ...(copy.length ? [new CopyWebpackPlugin({patterns: copy})] : [])
  ],
  module: {
    rules: [
      {
        test: /\.(sa|sc|c)ss$/,
        use: [
          MiniCssExtractPlugin.loader,
          {loader: 'css-loader', options: {sourceMap: true}},
          {loader: 'sass-loader', options: {sourceMap: true}}
        ]
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            babelrc: false,
            configFile: false,
            presets: [require.resolve('@babel/preset-env')],
            plugins: [require.resolve('@babel/plugin-transform-runtime')]
          }
        }
      }
    ]
  }
});

module.exports = [
  createConfig('ModernTheme'),
  createConfig('Textpad', [
    {from: path.resolve(__dirname, 'ModernIcons/apps/Textpad.png'), to: 'icon.png'}
  ])
];
