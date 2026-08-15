# ADR 0004 — Teste de carga com autocannon

Data: 2026-08-15 · Status: aceito

## Contexto

Antes do go-live, precisamos de um baseline de capacidade da API (container
único Node/Hono + Supabase) e de um jeito repetível de medir regressões de
performance. Requisito: rodar local contra o build de produção, sem
dependência em produção.

## Candidatos avaliados (prior-art)

| Ferramenta | Licença | Avaliação |
| --- | --- | --- |
| autocannon (npm) | MIT | Mantida (Matteo Collina), roda no Node do projeto como devDependency, scriptável em JS. **Escolhida.** |
| k6 (Grafana) | AGPL-3.0 | Excelente, mas binário externo e AGPL — desnecessário para baseline local. |
| artillery | MPL/da empresa | Pesada, foco em cenários SaaS pagos. |

## Decisão

Adotar **autocannon** como devDependency (modo 1 — primitiva de tooling).
Script em `scripts/stress-test.mjs`; alvo local (`http://localhost:3333`).
Nunca apontar para produção sem janela combinada e por conta própria do
operador humano.

## Consequências

- `npm run stress` dá baseline de req/s e latência (p50/p97.5/p99) para
  `/api/health` e `/api/products`.
- O limite real de produção depende da VPS (CPU/RAM) e do pooler do Supabase
  (porta 6543, modo transaction) — repetir o teste na VPS em horário calmo
  após o go-live para calibrar.
