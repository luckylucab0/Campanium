// ESLint-Konfiguration (Flat Config) für das gesamte Monorepo.
// TypeScript-Regeln über typescript-eslint, Formatierung überlässt ESLint komplett Prettier.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/dist-player/**', '**/node_modules/**', 'data/**', 'data.example/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      // Ungenutzte Variablen sind Fehler, mit _-Präfix aber bewusst erlaubt (z. B. in Signaturen).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Node-Skripte (plain JS): Node-Globals bekannt machen.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly' },
    },
  },
);
