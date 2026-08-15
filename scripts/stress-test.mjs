#!/usr/bin/env node
/**
 * Teste de carga local (ADR 0004): baseline de req/s e latência da API.
 *
 * Uso: com o servidor de pé em localhost:3333 (`npm run start:server` ou o
 * container Docker), rodar `npm run stress`. Aceita BASE_URL para apontar a
 * outro host — NUNCA produção fora de janela combinada.
 *
 * Cenários: /api/health (toca o banco — mede o caminho Node→Supabase) e
 * /api/products?limit=20 (catálogo, a rota mais quente da vitrine).
 * 1000 conexões simultâneas é o cenário pedido para o go-live.
 */
import autocannon from 'autocannon'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3333'

const SCENARIOS = [
  { name: 'health (Node→banco)', path: '/api/health', connections: 100, duration: 15 },
  { name: 'catálogo', path: '/api/products?limit=20', connections: 100, duration: 15 },
  { name: 'catálogo — pico 1000 conexões', path: '/api/products?limit=20', connections: 1000, duration: 20 },
]

const fmt = (n) => Math.round(n).toLocaleString('pt-BR')

for (const scenario of SCENARIOS) {
  process.stdout.write(`\n▶ ${scenario.name} — ${scenario.connections} conexões, ${scenario.duration}s\n`)
  const result = await autocannon({
    url: `${BASE_URL}${scenario.path}`,
    connections: scenario.connections,
    duration: scenario.duration,
  })
  const { requests, latency, errors, timeouts, non2xx } = result
  console.log(`  req/s: média ${fmt(requests.average)} · total ${fmt(requests.total)}`)
  console.log(
    `  latência (ms): p50 ${fmt(latency.p50)} · p97.5 ${fmt(latency.p97_5)} · p99 ${fmt(latency.p99)} · máx ${fmt(latency.max)}`,
  )
  console.log(`  erros: ${errors} · timeouts: ${timeouts} · non-2xx: ${non2xx}`)
  if (errors > 0 || timeouts > 0 || non2xx > 0) {
    console.log('  ⚠ houve falhas sob carga — investigar antes do go-live.')
  }
}
