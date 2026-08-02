import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Fase 4: testes de servidor (src/server/**) rodam em ambiente `node`,
    // sem o MSW da suite de UI, e batem no Supabase/Postgres reais via
    // .env.local (ver src/server/test/setup.ts). `test.projects` deixa
    // `vitest run`/`npm run test:unit` cobrindo os dois mundos numa so
    // chamada.
    projects: [
      {
        extends: true,
        test: {
          name: 'client',
          include: ['src/**/*.test.{js,jsx,ts,tsx}'],
          exclude: ['e2e/**', 'node_modules/**', 'dist/**', 'src/server/**/*.test.ts'],
          environment: 'jsdom',
          globals: true,
          setupFiles: './src/test/setup.ts',
        },
      },
      {
        extends: true,
        test: {
          name: 'server',
          include: ['src/server/**/*.test.ts'],
          exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
          environment: 'node',
          globals: true,
          setupFiles: './src/server/test/setup.ts',
        },
      },
    ],
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
