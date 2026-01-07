import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import prettierConfig from 'eslint-config-prettier'

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules', 'CodingBYD-CRM-old', 'BYD CRM', 'supabase/functions', '*.config.ts', '*.config.js'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        project: ['./tsconfig.app.json', './tsconfig.node.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // React hooks rules
      ...reactHooks.configs.recommended.rules,
      // Disable experimental React hooks rules (React Compiler only used in production)
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/react-compiler': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
      // React refresh rules
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Allow unused vars with underscore prefix
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // Allow any in specific cases (third-party libs)
      '@typescript-eslint/no-explicit-any': 'warn',
      // Allow non-null assertions in tests
      '@typescript-eslint/no-non-null-assertion': 'warn',
      // Allow empty functions for event handlers
      '@typescript-eslint/no-empty-function': 'off',
      // Prefer nullish coalescing
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      // Allow floating promises in event handlers
      '@typescript-eslint/no-floating-promises': 'warn',
      // Allow misused promises (common in React event handlers)
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      // Unsafe type rules - warn for incremental fixing (third-party libs often lack types)
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-enum-comparison': 'warn',
      // Other rules to warn
      '@typescript-eslint/require-await': 'warn',
      '@typescript-eslint/no-base-to-string': 'warn',
      '@typescript-eslint/restrict-template-expressions': 'warn',
      '@typescript-eslint/prefer-promise-reject-errors': 'warn',
    },
  },
  {
    files: ['**/*.{js,cjs,mjs}'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  prettierConfig
)
