/* eslint-env node */
/* global module */
module.exports = function babelConfig(api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
  }
}
