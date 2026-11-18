import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    // Archivos de configuración que se ejecutan en Node
    files: ['vite.config.js', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    // El router define páginas con lazy() y exporta la configuración de rutas.
    // No es un módulo de componentes, así que la regla de Fast Refresh no aplica.
    files: ['src/app/router.jsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    // Pruebas: globales de Vitest (describe, it, expect, vi)
    files: ['**/*.test.{js,jsx}', 'src/test/**/*.{js,jsx}'],
    languageOptions: { globals: { ...globals.node, ...globals.vitest } },
    rules: { 'react-refresh/only-export-components': 'off' },
  },
])
