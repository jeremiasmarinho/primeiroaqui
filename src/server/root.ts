import { Hono } from 'hono'
import { serveStatic } from '@hono/node-server/serve-static'
import { app as apiApp } from './app'

/**
 * App de producao: um unico processo Node serve a API e a SPA ja buildada.
 *
 * Por que um so container: o CLAUDE.md proibe recurso proprietario de
 * plataforma, e mesma-origem elimina CORS e qualquer `VITE_API_URL` — o
 * front chama `/api/...` relativo, funcione onde funcionar.
 *
 * A API fica sob `/api` para nao disputar URL com a SPA. Hoje as rotas do
 * front sao em pt-BR (`/produto/:id`) e as da API em ingles (`/products`),
 * entao nao ha colisao real ainda — mas o catch-all da SPA engoliria
 * qualquer rota nova que coincidisse. Prefixo agora custa zero: nenhum
 * `fetch` no front aponta para a API ainda.
 *
 * `app.ts` continua sendo a API pura, sem prefixo — e o que os testes
 * exercitam. Este arquivo so compoe.
 */
export const rootApp = new Hono()

rootApp.route('/api', apiApp)

// Sem isso, um /api/rota-inexistente cairia no catch-all e devolveria o HTML
// da SPA com status 200 — cliente de API recebendo pagina em vez de erro.
rootApp.all('/api/*', (c) => c.json({ error: 'Rota nao encontrada' }, 404))

// Caminho relativo ao process.cwd(), nao ao arquivo. Funciona porque o
// container tem WORKDIR /app e o CMD roda a partir dali — se o comando de
// start mudar de diretorio, os estaticos somem sem erro claro (404 na SPA
// inteira, servidor de pe).
const STATIC_ROOT = './dist'

// Assets com hash no nome (dist/assets/*) sao imutaveis: cache longo.
rootApp.use(
  '/assets/*',
  serveStatic({
    root: STATIC_ROOT,
    onFound: (_path, c) => {
      c.header('Cache-Control', 'public, max-age=31536000, immutable')
    },
  }),
)

rootApp.use('/*', serveStatic({ root: STATIC_ROOT }))

// Fallback de SPA: qualquer rota de cliente (/produto/1, /perfil, ...) que
// nao seja arquivo em disco devolve o index.html e o wouter resolve no browser.
rootApp.get(
  '/*',
  serveStatic({
    path: './dist/index.html',
    onFound: (_path, c) => {
      c.header('Cache-Control', 'no-cache')
    },
  }),
)
