const path = require('path');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

var isDevelopment = process.env.NODE_ENV !== 'production';

common_config = {
  mode: isDevelopment ? 'development' : 'production',
  devtool: 'inline-source-map',
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist')
  },
  // Typescript-like module resolution
  resolve: {
    extensions: ['.tsx', '.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: '/node_modules/',
        use: [
          {
            loader: 'babel-loader',
            options: {
              plugins: [isDevelopment && 'react-refresh/babel'].filter(Boolean),
              presets: ['@babel/preset-typescript']
            }
          },
          'ts-loader'
        ]
      },
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

client_config = {
  // Server with hot reload capabilities
  devServer: {
    contentBase: './dist',
    hot: true,
    hotOnly: true,
    injectHot: true,
  },
  // Build target
  entry: {
    client: './src/client/index.tsx'
  },
  // Hot reload
  plugins: [
    isDevelopment && new ReactRefreshWebpackPlugin(),
    isDevelopment && new webpack.HotModuleReplacementPlugin(),
    new HtmlWebpackPlugin({
      showErrors: true,
      title: 'Stars of Salem',
      template: './src/client/index.ejs'
    })
  ].filter(Boolean),
};
Object.setPrototypeOf(client_config, common_config);

server_config = {
  target: 'node',
  // Build target
  entry: {
    server: './src/server/index.ts'
  },
};
Object.setPrototypeOf(server_config, common_config);

module.exports = [client_config, server_config];