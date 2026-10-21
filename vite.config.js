import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import { validateLabConfiguration } from './config/test-lab.js'

export default defineConfig(({ mode }) => {
  // Dashboards may call Vite directly instead of the repository's lab command.
  if (process.env.CF_PAGES_BRANCH === 'test' || process.env.VERCEL_GIT_COMMIT_REF === 'test') {
    validateLabConfiguration(loadEnv(mode, process.cwd(), 'VITE_'))
  }
  return {
  logLevel: 'error',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  }
})
