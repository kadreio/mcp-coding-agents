/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/types/**',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Mock the ESM modules that cause issues
    '@anthropic-ai/claude-code': '<rootDir>/tests/mocks/claude-code.mock.js',
    'pkce-challenge': '<rootDir>/tests/mocks/pkce-challenge.js',
    'env-paths': '<rootDir>/tests/mocks/env-paths.js',
  },
  extensionsToTreatAsEsm: ['.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(@anthropic-ai/claude-code|env-paths)/)',
  ],
  testTimeout: 30000, // 30 seconds for integration tests
};