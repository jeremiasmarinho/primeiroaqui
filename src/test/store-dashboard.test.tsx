import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { vi } from 'vitest'
import MarketplaceApp from '../MarketplaceApp'
import { api } from '../lib/api'
import { seedLoggedInStorage } from './authTestHelpers'
import { db, seedStoreOwner, seedStoreOrder, seedStoreCustomer } from './mocks/handlers'

/**
 * Fluxos do lojista: onboarding (BUYER → STORE_OWNER → loja criada) e painel
 * /minha-loja (avançar status de pedido, publicar produto). A API é o fake do
 * MSW (mocks/handlers.ts); o papel real vem sempre do GET /api/me.
 */

const renderAt = (path: string) => {
  window.history.pushState({}, '', path)
  return render(<MarketplaceApp />)
}

describe('onboarding de lojista', () => {
  it('BUYER clica em "Vender no Primeiro Aqui", cadastra o negócio e cai no painel', async () => {
    seedLoggedInStorage()
    renderAt('/perfil')

    fireEvent.click(await screen.findByRole('button', { name: /vender no primeiro aqui/i }))

    // A promoção abre o modal de cadastro do negócio.
    expect(await screen.findByText(/configure seu negócio/i)).toBeInTheDocument()
    expect(db.user.role).toBe('STORE_OWNER')

    fireEvent.change(screen.getByPlaceholderText(/nome do negócio/i), {
      target: { value: 'Padaria do Bairro' },
    })
    fireEvent.click(screen.getByRole('button', { name: /salvar cadastro/i }))

    // Sucesso → navega para /minha-loja com a loja recém-criada.
    expect(await screen.findByRole('heading', { name: /padaria do bairro/i })).toBeInTheDocument()
    expect(db.myStores).toHaveLength(1)
    // Categoria padrão do form (nenhuma selecionada explicitamente) vai no
    // payload de POST /stores como `category`, não mais empilhada em description.
    expect(db.myStores[0]?.category).toBe('OUTROS')
  })

  it('cadastro do negócio envia a categoria selecionada no payload de POST /stores', async () => {
    seedLoggedInStorage()
    renderAt('/perfil')

    fireEvent.click(await screen.findByRole('button', { name: /vender no primeiro aqui/i }))
    expect(await screen.findByText(/configure seu negócio/i)).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText(/nome do negócio/i), {
      target: { value: 'Farmácia do Bairro' },
    })
    fireEvent.change(screen.getByDisplayValue('Outros'), { target: { value: 'FARMACIA' } })
    fireEvent.click(screen.getByRole('button', { name: /salvar cadastro/i }))

    expect(await screen.findByRole('heading', { name: /farmácia do bairro/i })).toBeInTheDocument()
    expect(db.myStores).toHaveLength(1)
    expect(db.myStores[0]?.category).toBe('FARMACIA')
  })

  it('STORE_OWNER vê o atalho "Minha loja" no perfil em vez do onboarding', async () => {
    seedStoreOwner()
    seedLoggedInStorage()
    renderAt('/perfil')

    expect(await screen.findByRole('link', { name: /minha loja/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /vender no primeiro aqui/i })).not.toBeInTheDocument()
  })

  /**
   * Regressão do bug "Minha loja não funciona" (Item 2, WU B-08): o teste
   * acima só checava que o link existia, nunca que CLICAR nele realmente
   * levava ao painel. Este cobre o fluxo ponta a ponta — clique, mudança de
   * URL e o painel de verdade na tela (não a EmptyState "Área do lojista",
   * que é o que aparece quando o guard de papel em StoreDashboardScreen
   * ainda não viu o papel STORE_OWNER).
   */
  it('clicar em "Minha loja" navega para /minha-loja e mostra o painel do lojista', async () => {
    seedStoreOwner()
    seedLoggedInStorage()
    renderAt('/perfil')

    const link = await screen.findByRole('link', { name: /minha loja/i })
    fireEvent.click(link)

    await waitFor(() => expect(window.location.pathname).toBe('/minha-loja'))
    expect(await screen.findByRole('heading', { name: /loja da ana/i })).toBeInTheDocument()
    expect(screen.queryByText(/área do lojista/i)).not.toBeInTheDocument()
  })
})

describe('painel /minha-loja', () => {
  it('mostra pedidos recebidos e avança o status pelo botão da próxima etapa', async () => {
    const store = seedStoreOwner()
    seedStoreOrder(store.id, { buyerName: 'João Comprador', status: 'PENDING' })
    seedLoggedInStorage()
    renderAt('/minha-loja')

    expect(await screen.findByText(/joão comprador/i)).toBeInTheDocument()
    // "Aguardando confirmação" também é o rótulo do card de métricas — o que
    // importa aqui é o chip do pedido existir junto com a ação de confirmar.
    expect(screen.getAllByText('Aguardando confirmação').length).toBeGreaterThan(1)

    fireEvent.click(screen.getByRole('button', { name: /confirmar pedido/i }))

    expect(await screen.findByText('Confirmado')).toBeInTheDocument()
    // Próxima ação válida muda junto; cancelar ainda é permitido em CONFIRMED.
    expect(screen.getByRole('button', { name: /iniciar preparação/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancelar pedido/i })).toBeInTheDocument()
    expect(db.storeOrders[0]?.status).toBe('CONFIRMED')
  })

  it('cancela um pedido pendente', async () => {
    const store = seedStoreOwner()
    seedStoreOrder(store.id, { status: 'PENDING' })
    seedLoggedInStorage()
    renderAt('/minha-loja')

    fireEvent.click(await screen.findByRole('button', { name: /cancelar pedido/i }))

    expect(await screen.findByText('Cancelado')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /confirmar pedido/i })).not.toBeInTheDocument()
  })

  it('publica um produto novo com preço em BRL', async () => {
    seedStoreOwner()
    seedLoggedInStorage()
    renderAt('/minha-loja')

    fireEvent.click(await screen.findByRole('tab', { name: /meus produtos/i }))
    expect(await screen.findByText(/sua vitrine está vazia/i)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Nome do produto'), { target: { value: 'Pão Francês' } })
    fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'Padaria' } })
    fireEvent.change(screen.getByLabelText('Preço em reais'), { target: { value: '0,90' } })
    fireEvent.change(screen.getByLabelText('Estoque'), { target: { value: '100' } })
    fireEvent.click(screen.getByRole('button', { name: /^publicar produto$/i }))

    expect(await screen.findByText('Pão Francês')).toBeInTheDocument()
    await waitFor(() => {
      const created = db.products.find((product) => product.title === 'Pão Francês')
      expect(created?.priceCents).toBe(90)
      expect(created?.stock).toBe(100)
    })
  })

  it('preço inválido bloqueia a publicação com mensagem clara', async () => {
    seedStoreOwner()
    seedLoggedInStorage()
    renderAt('/minha-loja')

    fireEvent.click(await screen.findByRole('tab', { name: /meus produtos/i }))
    fireEvent.change(await screen.findByLabelText('Nome do produto'), { target: { value: 'Produto X' } })
    fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'Casa' } })
    fireEvent.change(screen.getByLabelText('Preço em reais'), { target: { value: 'abc' } })
    fireEvent.click(screen.getByRole('button', { name: /^publicar produto$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/preço válido/i)
    expect(db.products.some((product) => product.title === 'Produto X')).toBe(false)
  })
})

describe('aba Clientes do painel /minha-loja', () => {
  it('renderiza os clientes agregados vindos de GET /me/store-customers', async () => {
    seedStoreOwner()
    seedStoreCustomer({
      buyerId: 'buyer-9',
      name: 'Maria Compradora',
      ordersCount: 3,
      totalCents: 15000,
      lastOrderStatus: 'DELIVERED',
    })
    seedLoggedInStorage()
    renderAt('/minha-loja')

    fireEvent.click(await screen.findByRole('tab', { name: /clientes/i }))

    expect(await screen.findByText('Maria Compradora')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('R$ 150,00')).toBeInTheDocument()
  })

  it('mostra o estado vazio quando não há clientes', async () => {
    seedStoreOwner()
    seedLoggedInStorage()
    renderAt('/minha-loja')

    fireEvent.click(await screen.findByRole('tab', { name: /clientes/i }))

    expect(await screen.findByText(/suas vendas aparecem aqui/i)).toBeInTheDocument()
  })
})

describe('embalagem para presente no painel /minha-loja (Item 9)', () => {
  it('liga o toggle "Embalo para presente" e salva via PATCH /stores/:id', async () => {
    const store = seedStoreOwner({ giftWrapAvailable: false })
    seedLoggedInStorage()
    renderAt('/minha-loja')

    await screen.findByRole('heading', { name: store.name })
    const toggle = screen.getByRole('switch', { name: /embalo para presente/i })
    expect(toggle).toHaveAttribute('aria-checked', 'false')

    fireEvent.click(toggle)

    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'))
    expect(db.myStores[0]?.giftWrapAvailable).toBe(true)
  })

  it('pedido com isGift mostra o selo "Presente" com nome e mensagem', async () => {
    const store = seedStoreOwner()
    seedStoreOrder(store.id, {
      buyerName: 'João Comprador',
      status: 'PENDING',
      isGift: true,
      giftRecipientName: 'Maria Presenteada',
      giftMessage: 'Feliz aniversário!',
    })
    seedLoggedInStorage()
    renderAt('/minha-loja')

    expect(await screen.findByText(/presente para maria presenteada/i)).toBeInTheDocument()
    expect(screen.getByText(/feliz aniversário/i)).toBeInTheDocument()
  })
})

describe('retirada na loja no painel /minha-loja (Item 14)', () => {
  it('habilita retirada preenchendo o endereço e clicando em "Habilitar retirada"', async () => {
    const store = seedStoreOwner({ pickupAvailable: false, address: null })
    seedLoggedInStorage()
    renderAt('/minha-loja')

    await screen.findByRole('heading', { name: store.name })
    const addressInput = screen.getByLabelText(/endereço para retirada/i)
    fireEvent.change(addressInput, { target: { value: 'Rua Teste, 1' } })
    fireEvent.click(screen.getByRole('button', { name: /habilitar retirada/i }))

    await waitFor(() => expect(db.myStores[0]?.pickupAvailable).toBe(true))
    expect(db.myStores[0]?.address).toBe('Rua Teste, 1')
  })

  it('não deixa habilitar retirada com o endereço vazio', async () => {
    const store = seedStoreOwner({ pickupAvailable: false, address: null })
    seedLoggedInStorage()
    renderAt('/minha-loja')

    await screen.findByRole('heading', { name: store.name })
    expect(screen.getByRole('button', { name: /habilitar retirada/i })).toBeDisabled()
  })

  it('desativa retirada sem exigir endereço', async () => {
    const store = seedStoreOwner({ pickupAvailable: true, address: 'Rua Já Salva, 5' })
    seedLoggedInStorage()
    renderAt('/minha-loja')

    await screen.findByRole('heading', { name: store.name })
    fireEvent.click(screen.getByRole('button', { name: /desativar retirada/i }))

    await waitFor(() => expect(db.myStores[0]?.pickupAvailable).toBe(false))
  })
})

describe('logo da loja no painel /minha-loja', () => {
  // `api.uploadStoreLogo` é mockado diretamente em vez de ir até o MSW via
  // fetch real — mesmo motivo documentado em profile-avatar.test.tsx: um
  // `<input type="file">` simulado em jsdom + fetch nativo do Node (undici)
  // produz um `File` que as checagens internas do undici não reconhecem ao
  // montar o corpo multipart. A rota real é exercitada pelos testes de
  // integração do servidor (src/server/routes/stores.test.ts).
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('envia um novo logo e atualiza a exibição', async () => {
    const store = seedStoreOwner()
    vi.spyOn(api, 'uploadStoreLogo').mockResolvedValue({
      store: { ...store, logoUrl: 'https://example.com/store-logos/logo.jpg' },
    })
    seedLoggedInStorage()
    renderAt('/minha-loja')

    await screen.findByRole('heading', { name: store.name })
    const input = screen.getByLabelText('Selecionar logo da loja') as HTMLInputElement
    const file = new File(['conteudo'], 'logo.jpg', { type: 'image/jpeg' })
    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByAltText('Logo da loja')).toBeInTheDocument()
    expect(api.uploadStoreLogo).toHaveBeenCalledTimes(1)
  })
})
