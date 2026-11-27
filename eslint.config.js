import globals from 'globals';

export default [
  { ignores: ['node_modules/**', 'assets/vendor/**', 'dist/**', '_test/**', 'coverage/**'] },
  {
    files: ['assets/js/**/*.js', 'sw.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...globals.serviceworker,
        ...globals.node,
        pdfjsLib: 'readonly',
        mammoth: 'readonly',
        JSZip: 'readonly',
        Tesseract: 'readonly'
      }
    },
    rules: {
      'no-undef': 'error',
      'no-redeclare': 'error',
      'no-dupe-keys': 'error',
      'no-unreachable': 'error',
      'no-cond-assign': 'error',
      'no-self-assign': 'error',
      'no-constant-condition': 'warn'
    }
  },
  {
    files: ['tests/**/*.js', 'scripts/**/*.mjs', '*.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser }
    },
    rules: { 'no-undef': 'error', 'no-redeclare': 'error' }
  }
];
