import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import next from 'eslint-config-next/core-web-vitals';
import prettier from 'eslint-config-prettier';

/**
 * Flat ESLint config for the whole monorepo.
 * - JS recommended + typescript-eslint recommended for every package
 * - Next.js (incl. react, react-hooks, jsx-a11y, import) rules for the web app
 * - eslint-config-prettier last so formatting is owned by Prettier, not ESLint
 */
export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/build/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/drizzle/**',
      'legacy/**',
      '**/*.tsbuildinfo',
      '**/next-env.d.ts',
      '**/*.config.js',
      '**/*.config.mjs',
      '**/*.config.cjs'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...next,
  prettier,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
      ],
      '@next/next/no-html-link-for-pages': 'off'
    }
  }
];
