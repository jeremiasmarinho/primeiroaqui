import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Em producao um so processo serve SPA e API na mesma origem (src/server/root.ts).
  // O proxy reproduz isso no dev: o front sempre chama `/api/...` relativo,
  // igual nos dois ambientes. Sem ele, o primeiro fetch escrito funcionaria em
  // producao e quebraria no dev — a pior ordem de falha possivel.
  server: {
    proxy: {
      '/api': 'http://localhost:3333',
    },
  },
  build: {
    emptyOutDir: false,
  },
})
