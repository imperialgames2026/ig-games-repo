import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/privacy-browser',fullyParallel:false,forbidOnly:true,retries:0,timeout:30000,
 use:{baseURL:'http://127.0.0.1:4181',launchOptions:process.env.IG_CHROMIUM_PATH?{executablePath:process.env.IG_CHROMIUM_PATH}:{},trace:'retain-on-failure'},
 webServer:{command:'npm run dev -- --host 127.0.0.1 --port 4181',url:'http://127.0.0.1:4181',reuseExistingServer:false,
 env:{VITE_SUPABASE_URL:'https://qonqemhljgxlwpghkxhn.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'synthetic-browser-key'}}
});
