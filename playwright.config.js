import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:8777',
    viewport: { width: 1280, height: 860 }
  },
  webServer: {
    command: 'npx http-server . -p 8777 -c-1 --silent',
    url: 'http://127.0.0.1:8777',
    reuseExistingServer: true,
    timeout: 20000
  }
});
