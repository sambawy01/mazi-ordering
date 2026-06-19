const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);
  
  // Fix node.js polyfill issues for web
  config.resolve.fallback = {
    ...config.resolve.fallback,
    crypto: false,
    stream: false,
    path: false,
    fs: false,
  };
  
  return config;
};