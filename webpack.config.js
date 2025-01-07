const path = require('path')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const TransformJson = require('transform-json-webpack-plugin')
const node_package = require('./package.json')

// base structure inspired by https://johnjonesfour.com/2020/05/13/building-browser-extensions-with-webpack/

/**
 * Heads up:
 * Static files and assets like svg-, png-, html-files have to be placed into the static folder and are
 * copied to the build folder using copy-webpack-plugin.
 * 
 * Scripts used inside the html files or scripts used in the extensions manifest (like background.js) are entry
 * points for the application and have to be configured as entries within webpack.
 * 
 * Disclaimer:
 * I would have liked to use the html-loader and using that automatically include scripts and graphics used
 * inside the html files, but there seems to be a problem with the extract-loader, that would also be needed for that,
 * and thus I gave up and chose this configuration, that is not quite as automatic, but seems to be working fine.
 */

const _mode = 'development'

// TODO: use none for production - https://webpack.js.org/configuration/devtool/
// NO: creates errors
const _devtool = "cheap-module-source-map"

const _resolve = {
  extensions: ['.js'],
  modules: [
    path.resolve(__dirname, 'node_modules'),
    'node_modules'
  ]
}

const _module = {
  rules: [
    {
      test: /\.css$/i,
      use: ["style-loader", "css-loader"],
    },
    {
      test: /\.der/,
      type: 'asset/resource',
        generator: {
        filename: '[name][ext]'
      },
    },
    // {
    //   test: /\.html$/,
    //   type: "asset/resource",
    //   generator: {
    //     filename: "[name][ext]",
    //   },
    // },
    {
      test: /\.html$/i,
      loader: "html-loader",
    },
    {
      test: /\.(png|svg|jpg|jpeg|gif)$/i,
      type: 'asset/resource',
    },
  ]
}

module.exports = [
  {
    devtool: _devtool,
    mode: _mode,
    entry: {
      'background' : path.resolve(__dirname, 'src', 'background', 'background.js'),
      'popup' : path.resolve(__dirname, 'src', 'popup', 'popup.js'),
      'settings' : path.resolve(__dirname, 'src', 'settings', 'settings.js'),
      'new-attestation' : path.resolve(__dirname, 'src', 'content', 'dialog', 'new-attestation.js'),
      'blocked-attestation' : path.resolve(__dirname, 'src', 'content', 'dialog', 'blocked-attestation.js'),
      'differs-attestation' : path.resolve(__dirname, 'src', 'content', 'dialog', 'differs-attestation.js'),
      'missing-attestation' : path.resolve(__dirname, 'src', 'content', 'dialog', 'missing-attestation.js'),
    },
    output: {
      path: path.resolve(__dirname, 'build'),
      filename: '[name].js',
      assetModuleFilename: "[name][ext]",
    },
    plugins: [
      new TransformJson({
        source: path.resolve(__dirname, 'src', 'manifest.json'),
        filename: 'manifest.json',
        object: {
          description: node_package.description,
          version: node_package.version
        }
      }),
      new CopyWebpackPlugin({
        patterns: [
          { from: path.resolve(__dirname, 'static', 'icons') },
          { from: path.resolve(__dirname, 'static', 'html') },
        ]
      })
    ],
    resolve: _resolve,
    module: _module
  },
]
