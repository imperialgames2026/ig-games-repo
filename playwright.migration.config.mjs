import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', fullyParallel: false, forbidOnly: true, retries: 0, timeout: 60000,
  use: { baseURL: 'http://127.0.0.1:4180', viewport: { width: 1280, height: 900 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 4180', url: 'http://127.0.0.1:4180', reuseExistingServer: false,
    env: { VITE_SUPABASE_URL: 'https://qonqemhljgxlwpghkxhn.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'browser-test-public-key' } },
});
