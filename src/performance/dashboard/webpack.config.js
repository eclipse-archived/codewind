/*******************************************************************************
* Copyright (c) 2020 IBM Corporation and others.
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the Eclipse Public License v2.0
* which accompanies this distribution, and is available at
* http://www.eclipse.org/legal/epl-v20.html
*
* Contributors:
*     IBM Corporation - initial API and implementation
******************************************************************************/

const HtmlWebPackPlugin = require("html-webpack-plugin");
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

const path = require("path");

module.exports = {
  performance: { hints: false,  maxEntrypointSize: 1700000,  maxAssetSize: 1700000},
  optimization: {
    splitChunks: {
      cacheGroups: {
        styles: {
          name: 'styles/styles',
          test: /\.css$/,
          chunks: 'all',
          enforce: true
        },
        static: {
          name: 'static/bundle',
          test: /\.js$/,
          chunks: 'all',
          enforce: true
        }
      }
    }
  },
  resolve: {
    extensions: ['.jsx', '.js']
  },
  output: {
    filename: '[name].js',
    path: __dirname + '/build'
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader"
        }
      },
      {
        test: /\.html$/,
        use: [
          {
            loader: "html-loader"
          }
        ]
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"]
      },
      {
        test: /\.scss$/,
        use: [
            "style-loader", 
            "css-loader",
            "sass-loader"
        ]
      },
      {
        test: /\.(png|jpe?g|gif)$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              outputPath: 'static'
            },
          },
        ],
      },
    ]
  },
  devServer: {
    contentBase: path.join(__dirname, 'build'),
    openPage: '../?project=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    compress: true,
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://localhost:9090/',
        secure: false,
      },
      '/socket.io': {
        target: 'http://localhost:9090/',
        secure: false,
      },
    },
  },
  plugins: [
    new CleanWebpackPlugin(),
    new HtmlWebPackPlugin({
      template: "./public/index.html",
      filename: "./index.html"
    })
  ]
};