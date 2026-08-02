import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.{js,jsx,ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      // WU-52: componentes e telas passam a contar. Antes ficavam de fora, o
      // que inflava o número — 96% medindo só lib/state não diz nada sobre a UI.
      include: [
        'src/lib/**/*.ts',
        'src/server/**/*.ts',
        'src/state/**/*.ts',
        'src/data/**/*.ts',
        'src/components/**/*.tsx',
        'src/screens/**/*.tsx',
      ],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
        // Lógica de dinheiro e de sessão: sem margem.
        'src/state/**/*.ts': {
          lines: 90,
          functions: 90,
          branches: 80,
          statements: 90,
        },
        'src/lib/**/*.ts': {
          lines: 80,
          functions: 80,
          branches: 70,
          statements: 80,
        },
        'src/server/**/*.ts': {
          lines: 80,
          functions: 80,
          branches: 70,
          statements: 80,
        },
      },
    },
  },
})
