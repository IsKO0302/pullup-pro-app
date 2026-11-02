import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import { defineConfig } from 'eslint/config';

const pureLayer = (message, extra = []) => ({
  'no-restricted-imports': ['error', { patterns: [{ group: ['react', 'react-dom', 'react/*', 'lucide-react', ...extra], message }] }],
});

export default defineConfig(
  { ignores: ['**/*.tmp.*', 'dist', 'dist-e2e', 'dev-dist', 'coverage', 'node_modules', 'playwright-report', 'test-results'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  // Layer boundaries: domain is pure logic (no React, no DOM, no storage).
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      ...pureLayer('src/domain must stay pure: no React, UI, storage or DOM.', ['**/ui/**', '**/features/**', '**/storage/**', '**/app/**']),
      'no-restricted-globals': ['error', 'window', 'document', 'localStorage', 'indexedDB', 'navigator', 'fetch'],
    },
  },
  { files: ['src/data/**/*.ts'], rules: pureLayer('src/data holds typed content only.', ['**/ui/**', '**/features/**', '**/storage/**', '**/app/**']) },
  { files: ['src/storage/**/*.ts'], rules: pureLayer('src/storage must not depend on UI.', ['**/ui/**', '**/features/**', '**/app/**']) },
  { files: ['src/ui/**/*.{ts,tsx}'], rules: { 'no-restricted-imports': ['error', { patterns: [{ group: ['**/features/**', '**/storage/**', '**/app/**'], message: 'src/ui is the design system: no screens or storage.' }] }] } },
  { files: ['e2e/**/*.ts', '*.config.{ts,js}', 'scripts/**/*.{ts,js,mjs}'], languageOptions: { globals: globals.node } },
);
