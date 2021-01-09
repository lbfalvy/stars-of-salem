const path = require('path');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');
const express = require('express');
const { default:findPlugins } = require('find-plugins');
const { join } = require('path');
const { existsSync } = require('fs');
const glob = require('glob');
const webpackNodeExternals = require('webpack-node-externals');

const isDevelopment = process.env.NODE_ENV !== 'production';
const plugins = findPlugins({
  scanAllDirs: true // Load any plugin, not just dependencies
});

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
  performance: {
    hints: false
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
    host: '0.0.0.0',
    disableHostCheck: true,
    https: true,
    proxy: {
      '/api': {
        target: 'ws://localhost:3000',
        ws: true,
        secure: false
      }
    },
    // Try to resolve static files from plugins
    before: function(app, server, compiler) {
      for (const plugin of plugins) {
        const path = join(plugin.dir, 'dist');
        if (existsSync(path)) {
          app.use(express.static(path));
        }
      }
    }
  },
  // Build target
  entry: {
    client: './src/client/index.tsx',
    audio: './src/client/audio_worklet.ts',
    ...plugins.reduce((table, plugin) => {
      const path = glob.sync(join(plugin.dir, 'dist/client.@(ts|tsx|js|jsx)'))[0];
      table['plugin_'+plugin.pkg.name] = path; // Either the client entry or undefined
    }, {})
  },
  // Hot reload
  plugins: [
    isDevelopment && new ReactRefreshWebpackPlugin({
      exclude: [
        '/node_modules/',
        /audio_worlet\.ts/,
      ]
    }),
    isDevelopment && new webpack.HotModuleReplacementPlugin(),
    new HtmlWebpackPlugin({
      showErrors: true,
      title: 'Stars of Salem',
      template: './src/client/index.ejs',
      excludeChunks: ['audio']
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
  externals: [webpackNodeExternals()]
};
Object.setPrototypeOf(server_config, common_config);

module.exports = [client_config, server_config];