import { config as loadEnv } from 'dotenv'

// Precisa rodar antes de importar `./app` — supabaseClient/prismaClient leem
// process.env no carregamento do modulo.
loadEnv({ path: '.env.local', quiet: true })

const { serve } = await import('@hono/node-server')
const { app } = await import('./app')

const port = Number(process.env.PORT ?? 3333)

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Servidor rodando em http://localhost:${info.port}`)
})
