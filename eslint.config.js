// ESLint (flat config). `src/gen/**` é gerado pelo Kubb — nunca se lint-a.
// `lint` = eslint + tsc (ver package.json). rules-of-hooks é erro (bug real); exhaustive-deps é aviso.
import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  { ignores: ['dist/**', 'src/gen/**', 'playwright-report/**', 'test-results/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx,js,jsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }],
      // O código tem `any` onde o Kubb/o `ui.jsx` não tipam; `strict` está desligado. Contado no relatório da F6c1, não bloqueia.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
)
