/* eslint-env node */
exports.env = {
  es6: true,
  browser: true,
  es2021: true,
  node: true,
}
exports.extends = ['airbnb-base', 'prettier']
exports.parser = '@babel/eslint-parser'
exports.parserOptions = {
  ecmaVersion: 12,
  sourceType: 'module',
}
exports.settings = {
  'import/resolver': {
    node: {
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
    },
  },
}
exports.rules = {
  'prettier/prettier': 'error',
  'no-unused-vars': 'off',
  'import/no-unresolved': ['error', { ignore: ['^expo-', '^@expo/'] }],
}
exports.plugins = ['prettier']
