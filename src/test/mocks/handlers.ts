import { http, HttpResponse } from 'msw'

import type {
  ApiAddress,
  ApiFavoriteProduct,
  ApiOrder,
  ApiProduct,
  ApiStore,
  ApiUser,
} from '../../lib/api'

/**
 * Fake em memória da API real para a suíte de UI.
 *
 * Espelha os shapes e regras de src/server/routes/* (campos exatos, erros
 * pt-BR, 409 de estoque) sem tocar em rede. O estado muda durante um teste
 * (favoritar, criar endereço, checkout) e `resetMockDb()` — chamado no
 * afterEach global (src/test/setup.ts) — devolve tudo ao ponto de partida.
 */

const now = '2026-08-01T12:00:00.000Z'

export const mockUser: ApiUser = {
  id: 'user-1',
  authUserId: 'auth-user-1',
  email: 'cliente@primeiroaqui.com',
  name: 'Cliente Primeiro Aqui',
  role: 'BUYER',
}

// Ids e títulos espelham o catálogo de demonstração antigo — os testes de
// tela citam esses nomes/urls (ex.: /produto/1, /loja/mercado-central).
export const mockStores: ApiStore[] = [
  { id: 'loja-vizinhanca', name: 'Loja Vizinhança', slug: 'loja-vizinhanca', description: 'Centro', latitude: 0, longitude: 0, isActive: true, createdAt: now, updatedAt: now },
  { id: 'mercado-central', name: 'Mercado Central', slug: 'mercado-central', description: 'Zona Norte', latitude: 0, longitude: 0, isActive: true, createdAt: now, updatedAt: now },
  { id: 'tech-shop', name: 'Tech Shop', slug: 'tech-shop', description: 'Centro', latitude: 0, longitude: 0, isActive: true, createdAt: now, updatedAt: now },
  { id: 'farmacia-local', name: 'Farmácia Local', slug: 'farmacia-local', description: 'Zona Sul', latitude: 0, longitude: 0, isActive: true, createdAt: now, updatedAt: now },
]

const baseProducts: ApiProduct[] = [
  { id: '1', storeId: 'loja-vizinhanca', title: 'Ventilador de Mesa Premium 6 Pás Silencioso', description: null, category: 'Casa', priceCents: 19990, stock: 10, isActive: true, createdAt: now, updatedAt: now },
  { id: '2', storeId: 'mercado-central', title: 'Kit Supermercado Express — 18 itens essenciais', description: null, category: 'Supermercado', priceCents: 12990, stock: 10, isActive: true, createdAt: now, updatedAt: now },
  { id: '3', storeId: 'tech-shop', title: 'Smartwatch Fitness GPS à Prova d’Água', description: null, category: 'Eletrônico', priceCents: 37990, stock: 5, isActive: true, createdAt: now, updatedAt: now },
  { id: '4', storeId: 'farmacia-local', title: 'Box de Cuidados Pessoais com 12 Produtos', description: null, category: 'Farmácia', priceCents: 8490, stock: 8, isActive: true, createdAt: now, updatedAt: now },
  { id: '5', storeId: 'farmacia-local', title: 'Whey Concentrado 900g Sabor Baunilha', description: null, category: 'Farmácia', priceCents: 13769, stock: 3, isActive: true, createdAt: now, updatedAt: now },
]

interface MockDb {
  products: ApiProduct[]
  favorites: Set<string>
  addresses: ApiAddress[]
  orders: ApiOrder[]
  seq: number
}

const createDb = (): MockDb => ({
  products: baseProducts.map((product) => ({ ...product })),
  favorites: new Set<string>(),
  addresses: [],
  orders: [],
  seq: 0,
})

export let db: MockDb = createDb()

export const resetMockDb = (): void => {
  db = createDb()
}

/** Semeia um endereço salvo — atalho para testes de checkout. */
export const seedAddress = (overrides: Partial<ApiAddress> = {}): ApiAddress => {
  const address: ApiAddress = {
    id: `addr-${++db.seq}`,
    userId: mockUser.id,
    label: 'Casa',
    street: 'Rua Um, 100',
    city: 'Centro',
    state: 'SP',
    zipCode: '12345-678',
    latitude: 0,
    longitude: 0,
    isDefault: db.addresses.length === 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
  db.addresses.unshift(address)
  return address
}

const unauthorized = () => HttpResponse.json({ error: 'Nao autenticado' }, { status: 401 })

const requireAuth = (request: Request): boolean =>
  Boolean(request.headers.get('authorization')?.startsWith('Bearer '))

export const handlers = [
  http.get('/__health', () => HttpResponse.json({ ok: true })),

  // ------------------------------------------------------------------ auth
  http.post('/api/auth/signup', async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string; name?: string }
    if (!body?.email || !body?.password || !body?.name) {
      return HttpResponse.json({ error: 'Dados invalidos' }, { status: 400 })
    }
    if (body.email === 'existente@primeiroaqui.com') {
      return HttpResponse.json({ error: 'Nao foi possivel criar o usuario' }, { status: 409 })
    }
    return HttpResponse.json(
      { user: { ...mockUser, email: body.email, name: body.name } },
      { status: 201 },
    )
  }),

  http.post('/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string }
    // Qualquer credencial com senha "errada..." falha; o resto autentica.
    if (!body?.email || body?.password === 'senha-errada') {
      return HttpResponse.json({ error: 'E-mail ou senha invalidos' }, { status: 401 })
    }
    return HttpResponse.json({
      session: { accessToken: 'test-token', refreshToken: 'test-refresh', expiresAt: 9999999999 },
      user: { ...mockUser, email: body.email },
    })
  }),

  http.post('/api/auth/logout', () => HttpResponse.json({ ok: true })),

  http.get('/api/me', ({ request }) => {
    if (!requireAuth(request)) return unauthorized()
    return HttpResponse.json({ user: mockUser })
  }),

  // --------------------------------------------------------------- catálogo
  http.get('/api/products', () => HttpResponse.json({ products: db.products })),

  http.get('/api/products/:id', ({ params }) => {
    const product = db.products.find((item) => item.id === params.id)
    if (!product || !product.isActive) {
      return HttpResponse.json({ error: 'Produto nao encontrado' }, { status: 404 })
    }
    return HttpResponse.json({ product })
  }),

  http.get('/api/stores/:id', ({ params }) => {
    const store = mockStores.find((item) => item.id === params.id)
    if (!store) return HttpResponse.json({ error: 'Loja nao encontrada' }, { status: 404 })
    return HttpResponse.json({ store })
  }),

  // -------------------------------------------------------------- favoritos
  http.post('/api/favorites/:productId', ({ request, params }) => {
    if (!requireAuth(request)) return unauthorized()
    db.favorites.add(String(params.productId))
    return HttpResponse.json({ ok: true })
  }),

  http.delete('/api/favorites/:productId', ({ request, params }) => {
    if (!requireAuth(request)) return unauthorized()
    db.favorites.delete(String(params.productId))
    return HttpResponse.json({ ok: true })
  }),

  http.get('/api/me/favorites', ({ request }) => {
    if (!requireAuth(request)) return unauthorized()
    const products: ApiFavoriteProduct[] = Array.from(db.favorites)
      .map((id) => db.products.find((product) => product.id === id))
      .filter((product): product is ApiProduct => Boolean(product))
      .map((product) => ({
        id: product.id,
        storeId: product.storeId,
        title: product.title,
        priceCents: product.priceCents,
        isActive: product.isActive,
        photoUrl: null,
      }))
    return HttpResponse.json({ products })
  }),

  // -------------------------------------------------------------- endereços
  http.post('/api/addresses', async ({ request }) => {
    if (!requireAuth(request)) return unauthorized()
    const body = (await request.json()) as Partial<ApiAddress>
    const address = seedAddress({
      label: body.label ?? '',
      street: body.street ?? '',
      city: body.city ?? '',
      state: body.state ?? '',
      zipCode: body.zipCode ?? '',
      isDefault: body.isDefault ?? false,
    })
    return HttpResponse.json({ address }, { status: 201 })
  }),

  http.get('/api/me/addresses', ({ request }) => {
    if (!requireAuth(request)) return unauthorized()
    return HttpResponse.json({ addresses: db.addresses })
  }),

  // ---------------------------------------------------------------- pedidos
  http.post('/api/orders', async ({ request }) => {
    if (!requireAuth(request)) return unauthorized()
    const body = (await request.json()) as {
      items?: Array<{ productId: string; quantity: number }>
      addressId?: string
    }
    if (!body?.items?.length || !body.addressId) {
      return HttpResponse.json({ error: 'Dados invalidos' }, { status: 400 })
    }
    if (!db.addresses.some((address) => address.id === body.addressId)) {
      return HttpResponse.json({ error: 'Endereco nao encontrado' }, { status: 404 })
    }

    const insufficient: Array<{ productId: string }> = []
    for (const item of body.items) {
      const product = db.products.find((candidate) => candidate.id === item.productId)
      if (!product || !product.isActive) {
        return HttpResponse.json(
          { error: 'Produto nao encontrado', productId: item.productId },
          { status: 404 },
        )
      }
      if (product.stock < item.quantity) insufficient.push({ productId: item.productId })
    }
    if (insufficient.length > 0) {
      return HttpResponse.json(
        { error: 'Estoque insuficiente', items: insufficient },
        { status: 409 },
      )
    }

    // Um pedido por loja, como o backend real.
    const byStore = new Map<string, Array<{ productId: string; quantity: number; unitPriceCents: number }>>()
    for (const item of body.items) {
      const product = db.products.find((candidate) => candidate.id === item.productId)!
      product.stock -= item.quantity
      const list = byStore.get(product.storeId) ?? []
      list.push({ productId: item.productId, quantity: item.quantity, unitPriceCents: product.priceCents })
      byStore.set(product.storeId, list)
    }

    const orders: ApiOrder[] = Array.from(byStore, ([storeId, items]) => {
      const orderId = `order-${++db.seq}`
      return {
        id: orderId,
        buyerId: mockUser.id,
        storeId,
        addressId: body.addressId!,
        totalCents: items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0),
        status: 'PENDING' as const,
        createdAt: now,
        updatedAt: now,
        items: items.map((item, index) => ({
          id: `${orderId}-item-${index}`,
          orderId,
          productId: item.productId,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
        })),
      }
    })
    db.orders.unshift(...orders)
    return HttpResponse.json({ orders }, { status: 201 })
  }),

  http.get('/api/me/orders', ({ request }) => {
    if (!requireAuth(request)) return unauthorized()
    return HttpResponse.json({ orders: db.orders })
  }),
]
