/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  globals: {
    console: 'readonly',
    window: 'readonly',
    document: 'readonly',
    localStorage: 'readonly',
    navigator: 'readonly',
    File: 'readonly',
    URL: 'readonly',
    Audio: 'readonly',
    HTMLDivElement: 'readonly',
    HTMLInputElement: 'readonly',
    HTMLSelectElement: 'readonly',
    setTimeout: 'readonly',
    alert: 'readonly',
    fetch: 'readonly',
  },
  plugins: [
    'react',
    'react-hooks',
    'jsx-a11y',
    '@typescript-eslint',
    'import',
    'prettier',
  ],
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:jsx-a11y/recommended',
    'plugin:react-hooks/recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript',
    'plugin:prettier/recommended',
  ],
  rules: {
    // ✅ Personnalisation des règles
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'react/react-in-jsx-scope': 'off', // inutile avec React 17+
    'no-undef': 'off',
    'import/order': ['warn', { 'newlines-between': 'always' }],
    'jsx-a11y/anchor-is-valid': 'warn',
    'react/prop-types': 'off',
  },
};
