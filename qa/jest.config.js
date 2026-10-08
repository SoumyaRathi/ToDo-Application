const path = require('path');

module.exports = {
  rootDir: path.join(__dirname, '..'),
  testEnvironment: 'node',
  testMatch: ['<rootDir>/qa/api/**/*.test.js'],
  globalSetup: '<rootDir>/qa/api/global-setup.js',
  globalTeardown: '<rootDir>/qa/api/global-teardown.js',
};
