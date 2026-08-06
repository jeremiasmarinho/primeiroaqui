import { config as loadEnv } from 'dotenv'

// Em desenvolvimento as variaveis vem de `.env.local`. Em producao vem do
// ambiente do container (Coolify/compose/systemd) — nenhum arquivo de env
// entra na imagem (ver .dockerignore), entao carregar aqui so mascararia
// uma variavel faltando.
//
// Precisa rodar antes de importar `./root` — supabaseClient/prismaClient leem
// process.env no carregamento do modulo.
if (process.env.NODE_ENV !== 'production') {
  loadEnv({ path: '.env.local', quiet: true })
}

const { serve } = await import('@hono/node-server')
const { rootApp } = await import('./root')

const port = Number(process.env.PORT ?? 3333)
// Bind explicito em todas as interfaces: o default do Node basta, mas dentro
// de container um bind em loopback deixa o servico invisivel de fora e o
// sintoma (connection refused no proxy) nao aponta para a causa.
const hostname = process.env.HOST ?? '0.0.0.0'

serve({ fetch: rootApp.fetch, port, hostname }, (info) => {
  console.log(`Servidor rodando em http://${hostname}:${info.port}`)
})
