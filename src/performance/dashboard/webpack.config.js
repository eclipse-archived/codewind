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
    compress: true,
    port: 3001
  },
  plugins: [
    new CleanWebpackPlugin(),
    new HtmlWebPackPlugin({
      template: "./public/index.html",
      filename: "./index.html"
    })
  ]
};