module.exports = {
  env: {
    browser: true,
    es6: true,
    jest: true,
    node: true,
  },
  extends: ['eslint:recommended', 'airbnb-base'],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
    cy: true,
    Cypress: true,
  },
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
  },
  rules: {
    'no-console': 0,
    indent: ['error', 2, { ignoreComments: true, SwitchCase: 1 }],
    'max-len': 0,
    'consistent-return': 0,
    camelcase: 0,
    'no-underscore-dangle': 0,
    'no-promise-executor-return': 0,
    'no-template-curly-in-string': 0,
    'new-cap': 0,
  },
};
