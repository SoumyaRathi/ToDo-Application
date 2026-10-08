const path = require('path');
const { defineConfig, devices } = require('@playwright/test');

const EVIDENCE = path.join(__dirname, 'evidence', 'due-date');

module.exports = defineConfig({
  testDir: path.join(__dirname, 'e2e'),
  testMatch: '**/*.spec.js',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30000,
  outputDir: path.join(EVIDENCE, 'pw-output'),
  reporter: [
    ['list'],
    ['json', { outputFile: path.join(EVIDENCE, 'e2e-results.json') }],
  ],
  globalSetup: require.resolve('./e2e/global-setup.js'),
  globalTeardown: require.resolve('./e2e/global-teardown.js'),
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Plain `node` (not nodemon) so writes to the JSON data files do not restart the server mid-test.
  webServer: {
    command: 'node todoServer.js',
    cwd: path.join(__dirname, '..'),
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
