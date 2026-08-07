import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { Router } from 'wouter'
import { http, HttpResponse } from 'msw'

import StoreRail from './StoreRail'
import { server } from '../test/mocks/server'
import { mockStores } from '../test/mocks/handlers'

describe('StoreRail', () => {
  it('busca GET /api/stores e renderiza as lojas retornadas', async () => {
    render(
      <Router>
        <StoreRail />
      </Router>,
    )

    const activeStores = mockStores.filter((store) => store.isActive)
    for (const store of activeStores) {
      expect(await screen.findByText(store.name)).toBeInTheDocument()
    }
  })

  it('nao renderiza nada quando a requisicao falha', async () => {
    server.use(
      http.get('/api/stores', () => HttpResponse.json({ error: 'Erro' }, { status: 500 })),
    )

    const { container } = render(
      <Router>
        <StoreRail />
      </Router>,
    )

    // Espera o efeito assentar: o rail deve ficar vazio (nao quebra a pagina).
    await waitFor(() => expect(container.querySelector('#lojas-da-cidade')).toBeNull())
  })
})
