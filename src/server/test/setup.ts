import { config as loadEnv } from 'dotenv'

/**
 * Setup dos testes de servidor (Hono/Prisma/Supabase). Roda em ambiente
 * `node` (nao `jsdom`) e sem o MSW da suite de UI — os testes de integracao
 * de auth batem no Supabase real do projeto (nao ha ambiente de teste
 * separado neste MVP). Ver `.env.local`.
 */
loadEnv({ path: '.env.local', quiet: true })
