// craco.config.js
const webpack = require('webpack');

module.exports = {
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      // Ensure resolve.fallback exists
      webpackConfig.resolve.fallback = webpackConfig.resolve.fallback || {};
      
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback, // Preserve existing fallbacks
        "querystring": require.resolve("querystring-es3"),
        "buffer": require.resolve("buffer/"),
        
        // Explicitly handle the 'process/browser' path that react-router seems to be looking for
        "process/browser": require.resolve("process/browser.js"),
        
        // Also provide a fallback for 'process' itself, pointing to the same browser polyfill
        "process": require.resolve("process/browser.js") 
        
        // Add other fallbacks here if you encounter more errors for other Node core modules:
        // "url": require.resolve("url/"),
        // "path": require.resolve("path-browserify"),
        // "stream": require.resolve("stream-browserify"),
        // "crypto": require.resolve("crypto-browserify"),
        // "http": require.resolve("stream-http"),
        // "https": require.resolve("https-browserify"),
        // "os": require.resolve("os-browserify/browser"),
        // "vm": require.resolve("vm-browserify"),
        // "assert": require.resolve("assert/")
      };

      // Ensure plugins array exists
      webpackConfig.plugins = webpackConfig.plugins || [];

      webpackConfig.plugins = [
        ...webpackConfig.plugins,
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
          // Provide the global 'process' variable, sourcing it from the polyfill.
          // Using 'process/browser.js' directly ensures it points to the correct file.
          process: ['process/browser.js'], 
        }),
      ];

      return webpackConfig;
    },
  },
};