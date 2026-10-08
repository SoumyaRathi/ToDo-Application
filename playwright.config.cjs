const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './qa/e2e',
  testMatch: '**/*.e2e.spec.ts',
  outputDir: './qa/.artifacts/playwright',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30000,
  reporter: [
    ['list'],
    ['json', { outputFile: 'qa/.artifacts/e2e-results.json' }],
  ],
  globalSetup: require.resolve('./qa/helpers/pw-global-setup.cjs'),
  globalTeardown: require.resolve('./qa/helpers/pw-global-teardown.cjs'),
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Plain node (not nodemon) so JSON data writes do not restart the server mid-test.
  webServer: {
    command: 'node todoServer.js',
    url: 'http://localhost:3000',
    reuseExistingServer: false,
    timeout: 30000,
  },
});
