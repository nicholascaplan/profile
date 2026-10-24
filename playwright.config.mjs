import { execFileSync } from 'node:child_process';
import { defineConfig, devices } from '@playwright/test';

// Pick a free port once in the main process; workers inherit it via the environment.
process.env.PLAYWRIGHT_PORT ??= execFileSync(
  process.execPath,
  ['-e', "const s=require('net').createServer().listen(0,'127.0.0.1',()=>{console.log(s.address().port);s.close()})"],
  { encoding: 'utf8' },
).trim();
const origin = `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['github'], ['json', { outputFile: 'test-results/report.json' }]]
    : [['list']],
  use: {
    baseURL: origin,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], channel: process.env.CI ? undefined : 'chrome' } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'], channel: process.env.CI ? undefined : 'chrome' } },
  ],
  webServer: {
    command: `node scripts/serve-static.mjs --port ${process.env.PLAYWRIGHT_PORT}`,
    url: origin,
    reuseExistingServer: !process.env.CI,
  },
});
