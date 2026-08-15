#!/usr/bin/env node
/**
 * Roda prisma migrate (status|deploy) contra o banco de PRODUÇÃO, carregando
 * DIRECT_URL de .env.production (nunca imprime valores). Passo humano do
 * runbook — `deploy` só depois de conferir `status`.
 *
 * Uso: node scripts/migrate-prod.mjs status|deploy
 */
import { spawnSync } from 'node:child_process'
import { config as loadEnv } from 'dotenv'

const action = process.argv[2]
if (!['status', 'deploy', 'diff', 'resolve-applied', 'exec'].includes(action)) {
  console.error('Uso: node scripts/migrate-prod.mjs status|deploy|diff|resolve-applied <migration>|exec <arquivo.sql>')
  process.exit(1)
}

loadEnv({ path: '.env.production', override: true, quiet: true })
if (!process.env.DIRECT_URL) {
  console.error('DIRECT_URL ausente em .env.production')
  process.exit(1)
}

// diff: o que falta no banco para chegar ao schema.prisma (script SQL, só leitura).
// resolve-applied: marca uma migration como aplicada sem rodá-la (usar só quando
// os objetos dela comprovadamente já existem no banco — protocolo anti-drift).
const args =
  action === 'diff'
    ? ['prisma', 'migrate', 'diff', '--from-config-datasource', '--to-schema', 'prisma/schema.prisma', '--script']
    : action === 'exec'
      ? ['prisma', 'db', 'execute', '--file', process.argv[3]]
      : action === 'resolve-applied'
      ? ['prisma', 'migrate', 'resolve', '--applied', process.argv[3]]
      : ['prisma', 'migrate', action]

const result = spawnSync('npx', args, {
  stdio: 'inherit',
  shell: true,
  env: process.env,
})
process.exit(result.status ?? 1)
