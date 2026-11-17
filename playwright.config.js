const {defineConfig} = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests', timeout: 20000, workers: 1,
  use: {baseURL:'http://127.0.0.1:8080', launchOptions:{executablePath:process.env.CHROMIUM_PATH || (require('node:fs').existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args:['--no-sandbox']}},
  webServer:{command:'python3 -m http.server 8080 --bind 127.0.0.1', port:8080, reuseExistingServer:false}
});
