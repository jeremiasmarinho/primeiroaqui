import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.{js,jsx,ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/lib/**/*.js', 'src/state/**/*.js'],
      thresholds: {
        lines: 0,
        functions: 0,
        branches: 0,
        statements: 0,
        'src/lib/**/*.js': {
          lines: 80,
          functions: 80,
          branches: 70,
          statements: 80,
        },
        'src/state/**/*.js': {
          lines: 90,
          functions: 90,
          branches: 70,
          statements: 90,
        },
      },
    },
  },
})
