import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import { resolveTestLabHostingEnvironment } from './config/test-lab-hosting.js'

export default defineConfig(({ mode }) => {
  // Dashboards may call Vite directly and inherit the production project's settings.
  const environment = loadEnv(mode, process.cwd(), 'VITE_')
  const resolved = resolveTestLabHostingEnvironment(environment)
  const define = resolved === environment ? {} : Object.fromEntries(
    ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_ANON_KEY']
      .map(name => [`import.meta.env.${name}`, JSON.stringify(resolved[name])]),
  )
  return {
    logLevel: 'error',
    plugins: [react()],
    define,
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('.', import.meta.url)),
      },
    },
  }
})
