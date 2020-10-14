const path = require('path');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
const webpack = require('webpack');

var isDevelopment = process.env.NODE_ENV !== 'production';

module.exports = {
  mode: isDevelopment ? 'development' : 'production',
  devtool: 'inline-source-map',
  devServer: {
    contentBase: './dist',
    hot: true
  },
  // Build targets
  entry: {
    client: './src/client/index.tsx',
    server: './src/server/index.ts'
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist')
  },
  // Typescript-like module resolution
  resolve: {
    extensions: ['.tsx', '.ts', '.js']
  },
  // Hot reload
  plugins: [
    isDevelopment && new ReactRefreshWebpackPlugin()
  ].filter(Boolean),
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: '/node_modules/',
        use: [
          isDevelopment && {
            loader: 'babel-loader',
            options: { plugins: [ 'react-refresh/babel' ] }
          },
          'ts-loader'
        ].filter(Boolean)
      },
      /*{
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: '/node_modules/'
      },*/
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader'
        ]
      },
      {
        test: /\.(png|svg|jpg|gif)$/,
        use: 'file-loader'
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/,
        use: 'file-loader'
      }
    ]
  }
};