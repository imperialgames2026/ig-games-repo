import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/payment-browser',workers:1,timeout:30000,
 use:{baseURL:'http://127.0.0.1:4182',launchOptions:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']}:{}},
 webServer:{command:'npm run dev -- --host 127.0.0.1 --port 4182',url:'http://127.0.0.1:4182',reuseExistingServer:false,
 env:{VITE_SUPABASE_URL:'https://qonqemhljgxlwpghkxhn.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'browser-test-public-key'}}
});
