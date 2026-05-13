import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx http-server -p 5173 -c-1 --silent .',
    url: 'http://127.0.0.1:5173/index.html',
    reuseExistingServer: true,
    timeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          executablePath: process.env.CHROME_PATH || '/opt/chrome-linux64/chrome',
          args: ['--no-sandbox'],
        },
      },
    },
  ],
});
