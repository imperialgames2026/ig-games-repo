import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e-auth',workers:1,timeout:45000,expect:{timeout:12000},
 reporter:[['line']],outputDir:'test-results/auth',
 projects:[{name:'desktop-chromium',use:{...devices['Desktop Chrome']}}],
 use:{baseURL:'http://127.0.0.1:4173',launchOptions:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']}:{}}
 ,webServer:{command:'npm run preview -- --host 127.0.0.1 --port 4173',url:'http://127.0.0.1:4173/login',reuseExistingServer:true,timeout:60000}
});
