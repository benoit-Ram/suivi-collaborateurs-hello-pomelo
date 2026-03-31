import globals from 'globals';

export default [
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-undef': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'eqeqeq': 'error',
      'curly': 'error',
    },
  },
  {
    // Fichiers legacy — règles plus souples
    files: ['admin.js', 'collab.js', 'utils.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        // Globales legacy
        SUPABASE_URL: 'readonly',
        SUPABASE_KEY: 'readonly',
        sb: 'readonly',
        DB: 'writable',
        SETTINGS: 'writable',
        COLLABS: 'writable',
      },
    },
    rules: {
      'no-unused-vars': 'off',
      'no-undef': 'warn',
    },
  },
];
