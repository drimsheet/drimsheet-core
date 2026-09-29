const base = require('./jest.config');

module.exports = {
  ...base,
  roots: ['<rootDir>/test/db'],
  testMatch: ['**/*.db.spec.ts'],
  testPathIgnorePatterns: ['/node_modules/'],
  testTimeout: 15000,
};
