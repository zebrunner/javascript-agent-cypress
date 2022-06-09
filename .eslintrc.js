module.exports = {
    env: {
      browser: true,
      es6: true,
      jest: true,
      node: true
    },
    extends: "eslint:recommended",
    globals: {
      Atomics: 'readonly',
      SharedArrayBuffer: 'readonly',
      cy: true,
      Cypress: true
    },
    parserOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
    },
    rules: {
      'no-console': 0,
    },
  };