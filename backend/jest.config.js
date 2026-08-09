module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/unit/**/*.test.js'],
  collectCoverageFrom: ['src/services/**/*.js'],
  coverageThreshold: {
    'src/services/**/*.js': {
      lines: 80,
      functions: 80
    }
  }
};
