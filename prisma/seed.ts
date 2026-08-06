// Seed de desenvolvimento — popula o banco com lojas, produtos, clientes,
// pedidos e avaliacoes ficticios para permitir testar o app fim a fim.
//
// Idempotente por construcao: cada entidade e resolvida por uma chave natural
// (email, slug, titulo dentro da loja) antes de decidir criar ou reaproveitar.
// Reordar o script nao duplica nada.
//
// Uso:
//   npm run db:seed                  -> carrega .env.local (padrao do repo)
//   npm run db:seed -- --env .env.production -> aponta para outro ambiente
//
// Precisa de DATABASE_URL (runtime, pooler transaction) e das credenciais do
// Supabase Auth (SUPABASE_URL / SUPABASE_SERVICE_ROLE) — os usuarios de seed
// existem tanto no Supabase Auth quanto na tabela `users` (FK por authUserId,
// igual ao fluxo real de signup). Ver src/server/test/authFixtures.ts.

import { config as loadEnv } from 'dotenv'

// --env precisa ser lido e aplicado ANTES de importar prismaClient/supabaseClient,
// que leem process.env no top-level do modulo.
const envFlagIndex = process.argv.indexOf('--env')
const envFile = envFlagIndex !== -1 ? process.argv[envFlagIndex + 1] : '.env.local'
if (!envFile) {
  throw new Error('--env foi passado sem valor')
}
loadEnv({ path: envFile, quiet: true })

const { prisma } = await import('../src/server/lib/prismaClient')
const { supabaseAdmin } = await import('../src/server/lib/supabaseClient')
const { productImage, storeImage } = await import('../src/lib/images')
const { UserRole, OrderStatus } = await import('@prisma/client')

/** Senha forte fixa de seed — apenas ambientes de dev/homolog, nunca producao real de cliente. */
const SEED_PASSWORD = 'PrimeiroAqui!Seed2026'

/** Cria (ou reaproveita) um usuario no Supabase Auth pelo e-mail — idempotente. */
async function upsertAuthUser(email: string): Promise<string> {
  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: SEED_PASSWORD,
    email_confirm: true,
  })
  if (!createError && created.user) {
    return created.user.id
  }

  // Ja existe: Supabase Auth nao tem "getUserByEmail" direto na API admin
  // usada aqui, entao paginamos listUsers ate achar o e-mail.
  let page = 1
  const perPage = 200
  for (;;) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (error) {
      throw new Error(`Falha ao listar usuarios do Supabase Auth: ${error.message}`)
    }
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (found) return found.id
    if (data.users.length < perPage) break
    page += 1
  }

  throw new Error(
    `Nao foi possivel criar nem localizar o usuario "${email}" no Supabase Auth (createUser: ${createError?.message})`,
  )
}

/** Upsert de User (Prisma) por e-mail, vinculado ao authUserId do Supabase. */
async function upsertUser(params: { email: string; name: string; role: (typeof UserRole)[keyof typeof UserRole] }) {
  const authUserId = await upsertAuthUser(params.email)
  return prisma.user.upsert({
    where: { email: params.email },
    update: { name: params.name, role: params.role, authUserId },
    create: { email: params.email, name: params.name, role: params.role, authUserId },
  })
}

type StoreSeed = {
  slug: string
  name: string
  description: string
  category: string
  ownerName: string
  ownerEmail: string
  latitude: number
  longitude: number
}

// Mesma cidade (Belo Horizonte, MG) — coordenadas plausiveis espalhadas pelos
// bairros centrais, o suficiente para exercitar busca por proximidade.
const STORE_SEEDS: StoreSeed[] = [
  {
    slug: 'mercearia-do-bairro',
    name: 'Mercearia do Bairro',
    description: 'Mercearia de bairro com hortifruti fresco, mercearia seca e atendimento de confianca.',
    category: 'Supermercado',
    ownerName: 'Rosana Ferreira',
    ownerEmail: 'rosana.ferreira@exemplo-primeiroaqui.com.br',
    latitude: -19.9227,
    longitude: -43.9451,
  },
  {
    slug: 'farmacia-vida-nova',
    name: 'Farmácia Vida Nova',
    description: 'Farmácia de manipulação e genéricos, com entrega expressa no bairro.',
    category: 'Farmácia',
    ownerName: 'Carlos Eduardo Nunes',
    ownerEmail: 'carlos.nunes@exemplo-primeiroaqui.com.br',
    latitude: -19.9186,
    longitude: -43.9386,
  },
  {
    slug: 'padaria-sao-jose',
    name: 'Padaria São José',
    description: 'Pães e salgados fresquinhos desde 1998, direto do forno para sua mesa.',
    category: 'Padaria',
    ownerName: 'José Antônio Silva',
    ownerEmail: 'jose.silva@exemplo-primeiroaqui.com.br',
    latitude: -19.9294,
    longitude: -43.9378,
  },
  {
    slug: 'petshop-amigo-fiel',
    name: 'Petshop Amigo Fiel',
    description: 'Ração, banho e tosa, e acessórios para cães e gatos com carinho de vizinho.',
    category: 'Pet',
    ownerName: 'Fernanda Lima',
    ownerEmail: 'fernanda.lima@exemplo-primeiroaqui.com.br',
    latitude: -19.9155,
    longitude: -43.9502,
  },
  {
    slug: 'hortifruti-flor-do-campo',
    name: 'Hortifruti Flor do Campo',
    description: 'Frutas, verduras e legumes selecionados direto do produtor, todos os dias.',
    category: 'Hortifruti',
    ownerName: 'Marcos Paulo Andrade',
    ownerEmail: 'marcos.andrade@exemplo-primeiroaqui.com.br',
    latitude: -19.9263,
    longitude: -43.9309,
  },
]

// Catalogo de produtos por categoria de loja — ~10 itens plausiveis cada.
const PRODUCT_CATALOG: Record<string, { title: string; category: string; priceCents: number; stock: number }[]> = {
  Supermercado: [
    { title: 'Arroz Branco Tipo 1 5kg', category: 'Mercearia', priceCents: 2890, stock: 40 },
    { title: 'Feijão Carioca 1kg', category: 'Mercearia', priceCents: 890, stock: 60 },
    { title: 'Óleo de Soja 900ml', category: 'Mercearia', priceCents: 750, stock: 50 },
    { title: 'Açúcar Refinado 1kg', category: 'Mercearia', priceCents: 550, stock: 55 },
    { title: 'Café Torrado e Moído 500g', category: 'Mercearia', priceCents: 1590, stock: 35 },
    { title: 'Leite Integral 1L', category: 'Laticínios', priceCents: 620, stock: 80 },
    { title: 'Papel Higiênico 12 Rolos', category: 'Higiene', priceCents: 2290, stock: 30 },
    { title: 'Detergente Neutro 500ml', category: 'Limpeza', priceCents: 340, stock: 45 },
    { title: 'Macarrão Espaguete 500g', category: 'Mercearia', priceCents: 490, stock: 65 },
    { title: 'Refrigerante Cola 2L', category: 'Bebidas', priceCents: 990, stock: 40 },
  ],
  Farmácia: [
    { title: 'Dipirona Sódica 500mg 10 Comprimidos', category: 'Medicamento', priceCents: 890, stock: 100 },
    { title: 'Álcool em Gel 70% 500ml', category: 'Higiene', priceCents: 1290, stock: 70 },
    { title: 'Protetor Solar FPS 60 120ml', category: 'Dermocosmético', priceCents: 4990, stock: 25 },
    { title: 'Vitamina C 1g 30 Comprimidos', category: 'Suplemento', priceCents: 2490, stock: 40 },
    { title: 'Fralda Geriátrica Pacote com 8', category: 'Cuidados', priceCents: 3290, stock: 20 },
    { title: 'Termômetro Digital', category: 'Equipamento', priceCents: 2990, stock: 15 },
    { title: 'Soro Fisiológico 500ml', category: 'Medicamento', priceCents: 1190, stock: 50 },
    { title: 'Máscara Descartável Caixa com 50', category: 'Proteção', priceCents: 1990, stock: 60 },
    { title: 'Pomada para Assaduras 45g', category: 'Cuidados', priceCents: 1690, stock: 35 },
    { title: 'Shampoo Anticaspa 200ml', category: 'Dermocosmético', priceCents: 2190, stock: 30 },
  ],
  Padaria: [
    { title: 'Pão Francês (kg)', category: 'Pães', priceCents: 1490, stock: 100 },
    { title: 'Pão de Queijo Assado (dúzia)', category: 'Salgados', priceCents: 1890, stock: 40 },
    { title: 'Bolo de Fubá Caseiro', category: 'Doces', priceCents: 2490, stock: 15 },
    { title: 'Croissant de Presunto e Queijo', category: 'Salgados', priceCents: 990, stock: 30 },
    { title: 'Baguete Artesanal', category: 'Pães', priceCents: 1290, stock: 25 },
    { title: 'Torta de Frango (fatia)', category: 'Salgados', priceCents: 1190, stock: 20 },
    { title: 'Sonho Recheado', category: 'Doces', priceCents: 690, stock: 35 },
    { title: 'Pão Integral Fatiado 500g', category: 'Pães', priceCents: 1590, stock: 30 },
    { title: 'Café Expresso', category: 'Bebidas', priceCents: 550, stock: 999 },
    { title: 'Suco Natural de Laranja 300ml', category: 'Bebidas', priceCents: 890, stock: 40 },
  ],
  Pet: [
    { title: 'Ração Cães Adultos 10,1kg', category: 'Ração', priceCents: 12990, stock: 20 },
    { title: 'Ração Gatos Castrados 3kg', category: 'Ração', priceCents: 6990, stock: 25 },
    { title: 'Areia Higiênica para Gatos 4kg', category: 'Higiene', priceCents: 3490, stock: 30 },
    { title: 'Petisco Sachê Cães 85g', category: 'Petisco', priceCents: 490, stock: 80 },
    { title: 'Shampoo Pet Neutro 500ml', category: 'Higiene', priceCents: 2990, stock: 20 },
    { title: 'Coleira Ajustável Nylon', category: 'Acessório', priceCents: 3990, stock: 18 },
    { title: 'Brinquedo Mordedor para Cães', category: 'Acessório', priceCents: 2490, stock: 25 },
    { title: 'Caixa de Areia Sanitária', category: 'Acessório', priceCents: 5990, stock: 10 },
    { title: 'Petisco Bifinho Cães 500g', category: 'Petisco', priceCents: 1990, stock: 40 },
    { title: 'Tapete Higiênico Pacote com 30', category: 'Higiene', priceCents: 4490, stock: 22 },
  ],
  Hortifruti: [
    { title: 'Banana Prata (kg)', category: 'Fruta', priceCents: 590, stock: 60 },
    { title: 'Maçã Gala (kg)', category: 'Fruta', priceCents: 890, stock: 50 },
    { title: 'Tomate Salada (kg)', category: 'Legume', priceCents: 790, stock: 45 },
    { title: 'Alface Crespa (unidade)', category: 'Verdura', priceCents: 390, stock: 40 },
    { title: 'Cebola (kg)', category: 'Legume', priceCents: 690, stock: 55 },
    { title: 'Batata Inglesa (kg)', category: 'Legume', priceCents: 650, stock: 55 },
    { title: 'Laranja Pera (kg)', category: 'Fruta', priceCents: 490, stock: 50 },
    { title: 'Cenoura (kg)', category: 'Legume', priceCents: 550, stock: 40 },
    { title: 'Mamão Papaya (unidade)', category: 'Fruta', priceCents: 690, stock: 30 },
    { title: 'Couve Manteiga (maço)', category: 'Verdura', priceCents: 350, stock: 35 },
  ],
}

type BuyerSeed = { name: string; email: string; address: { label: string; street: string; city: string; state: string; zipCode: string; latitude: number; longitude: number } }

const BUYER_SEEDS: BuyerSeed[] = [
  { name: 'Ana Paula Souza', email: 'ana.souza@exemplo-primeiroaqui.com.br', address: { label: 'Casa', street: 'Rua das Acácias, 120', city: 'Belo Horizonte', state: 'MG', zipCode: '30130-000', latitude: -19.921, longitude: -43.941 } },
  { name: 'Bruno Costa Ribeiro', email: 'bruno.ribeiro@exemplo-primeiroaqui.com.br', address: { label: 'Casa', street: 'Av. Afonso Pena, 2400', city: 'Belo Horizonte', state: 'MG', zipCode: '30130-007', latitude: -19.9245, longitude: -43.938 } },
  { name: 'Cecília Mendes Alves', email: 'cecilia.alves@exemplo-primeiroaqui.com.br', address: { label: 'Trabalho', street: 'Rua da Bahia, 800', city: 'Belo Horizonte', state: 'MG', zipCode: '30160-011', latitude: -19.9198, longitude: -43.9345 } },
  { name: 'Diego Ramos Teixeira', email: 'diego.teixeira@exemplo-primeiroaqui.com.br', address: { label: 'Casa', street: 'Rua Pium-í, 45', city: 'Belo Horizonte', state: 'MG', zipCode: '30310-140', latitude: -19.933, longitude: -43.937 } },
  { name: 'Elaine Cristina Rocha', email: 'elaine.rocha@exemplo-primeiroaqui.com.br', address: { label: 'Casa', street: 'Rua Timbiras, 1500', city: 'Belo Horizonte', state: 'MG', zipCode: '30140-060', latitude: -19.915, longitude: -43.94 } },
  { name: 'Felipe Augusto Martins', email: 'felipe.martins@exemplo-primeiroaqui.com.br', address: { label: 'Casa', street: 'Rua Sergipe, 900', city: 'Belo Horizonte', state: 'MG', zipCode: '30130-171', latitude: -19.9265, longitude: -43.933 } },
  { name: 'Gabriela Nascimento Reis', email: 'gabriela.reis@exemplo-primeiroaqui.com.br', address: { label: 'Casa', street: 'Rua Grão Pará, 600', city: 'Belo Horizonte', state: 'MG', zipCode: '30150-341', latitude: -19.9302, longitude: -43.945 } },
  { name: 'Henrique Oliveira Dias', email: 'henrique.dias@exemplo-primeiroaqui.com.br', address: { label: 'Casa', street: 'Av. do Contorno, 5000', city: 'Belo Horizonte', state: 'MG', zipCode: '30110-016', latitude: -19.918, longitude: -43.955 } },
  { name: 'Isabela Fernandes Castro', email: 'isabela.castro@exemplo-primeiroaqui.com.br', address: { label: 'Casa', street: 'Rua Curitiba, 300', city: 'Belo Horizonte', state: 'MG', zipCode: '30170-121', latitude: -19.9236, longitude: -43.9305 } },
  { name: 'João Vitor Pereira Lima', email: 'joao.lima@exemplo-primeiroaqui.com.br', address: { label: 'Casa', street: 'Rua Padre Eustáquio, 1800', city: 'Belo Horizonte', state: 'MG', zipCode: '30720-000', latitude: -19.905, longitude: -43.96 } },
]

const REVIEW_COMMENTS = [
  'Produto excelente, chegou rápido e bem embalado.',
  'Bom custo-benefício, comprarei novamente.',
  'Qualidade acima do esperado, recomendo.',
  'Atendimento da loja foi ótimo, produto conforme anunciado.',
  'Entrega dentro do prazo, tudo certinho.',
  'Muito satisfeito com a compra.',
  'Produto fresco e de boa qualidade.',
  'Preço justo e entrega rápida.',
  'Já é a segunda vez que compro, sempre bom.',
  'Vale a pena, recomendo a loja.',
]

/** Data aleatória dentro dos últimos `days` dias, para espalhar createdAt. */
function randomRecentDate(days: number): Date {
  const now = Date.now()
  const past = now - Math.random() * days * 24 * 60 * 60 * 1000
  return new Date(past)
}

function pick<T>(arr: T[]): T {
  if (arr.length === 0) {
    throw new Error('pick() chamado com array vazio')
  }
  const value = arr[Math.floor(Math.random() * arr.length)]
  // noUncheckedIndexedAccess: o guard de length acima garante que o índice é válido.
  return value as T
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

async function main() {
  console.log(`Seed iniciado — env carregado de "${envFile}"`)

  // 1) Admin
  const admin = await upsertUser({
    email: 'admin@exemplo-primeiroaqui.com.br',
    name: 'Administrador Primeiro Aqui',
    role: UserRole.ADMIN,
  })

  // 2) Lojas + owners
  const createdStores: { id: string; slug: string; category: string }[] = []
  for (const seed of STORE_SEEDS) {
    const owner = await upsertUser({ email: seed.ownerEmail, name: seed.ownerName, role: UserRole.STORE_OWNER })

    const store = await prisma.store.upsert({
      where: { slug: seed.slug },
      update: {
        name: seed.name,
        description: seed.description,
        latitude: seed.latitude,
        longitude: seed.longitude,
        ownerId: owner.id,
        isActive: true,
      },
      create: {
        slug: seed.slug,
        name: seed.name,
        description: seed.description,
        latitude: seed.latitude,
        longitude: seed.longitude,
        ownerId: owner.id,
        isActive: true,
      },
    })
    createdStores.push({ id: store.id, slug: store.slug, category: seed.category })
  }

  // 3) Produtos (busca por storeId+title antes de criar — idempotente) + 1 foto cada
  let productsCreated = 0
  let productsReused = 0
  const productsByStore: Record<string, { id: string; priceCents: number }[]> = {}

  for (const store of createdStores) {
    const catalog = PRODUCT_CATALOG[store.category] ?? []
    const storeProducts: { id: string; priceCents: number }[] = []
    productsByStore[store.id] = storeProducts

    for (const item of catalog) {
      let product = await prisma.product.findFirst({
        where: { storeId: store.id, title: item.title },
      })

      if (!product) {
        product = await prisma.product.create({
          data: {
            storeId: store.id,
            title: item.title,
            description: `${item.title} — disponível em ${store.slug}.`,
            category: item.category,
            priceCents: item.priceCents,
            stock: item.stock,
            isActive: true,
          },
        })
        productsCreated += 1
      } else {
        productsReused += 1
      }

      const productSlug = `${store.slug}-${item.title}`
      const existingPhoto = await prisma.productPhoto.findFirst({ where: { productId: product.id } })
      if (!existingPhoto) {
        await prisma.productPhoto.create({
          data: {
            productId: product.id,
            url: productImage(item.category, productSlug, 600),
            thumbUrl: productImage(item.category, productSlug, 300),
            path: `seed/${productSlug}`,
            position: 0,
          },
        })
      }

      storeProducts.push({ id: product.id, priceCents: item.priceCents })
    }
  }

  // 4) Compradores + endereço padrão
  const buyers: { id: string; addressId: string }[] = []
  for (const seed of BUYER_SEEDS) {
    const user = await upsertUser({ email: seed.email, name: seed.name, role: UserRole.BUYER })

    let address = await prisma.address.findFirst({ where: { userId: user.id, isDefault: true } })
    if (!address) {
      address = await prisma.address.create({
        data: {
          userId: user.id,
          label: seed.address.label,
          street: seed.address.street,
          city: seed.address.city,
          state: seed.address.state,
          zipCode: seed.address.zipCode,
          latitude: seed.address.latitude,
          longitude: seed.address.longitude,
          isDefault: true,
        },
      })
    }
    buyers.push({ id: user.id, addressId: address.id })
  }

  // 5) Pedidos (idempotente por contagem: só cria a diferença até atingir o alvo)
  const ORDER_TARGET = 15
  const existingOrderCount = await prisma.order.count()
  const ordersToCreate = Math.max(0, ORDER_TARGET - existingOrderCount)
  const statuses = Object.values(OrderStatus)

  for (let i = 0; i < ordersToCreate; i++) {
    const store = pick(createdStores)
    const buyer = pick(buyers)
    const catalog = productsByStore[store.id]
    if (!catalog || catalog.length === 0) continue

    const itemCount = randomInt(1, 3)
    const orderItems = Array.from({ length: itemCount }, () => {
      const product = pick(catalog)
      return { ...product, quantity: randomInt(1, 3) }
    })
    const totalCents = orderItems.reduce((sum, item) => sum + item.priceCents * item.quantity, 0)

    await prisma.order.create({
      data: {
        buyerId: buyer.id,
        storeId: store.id,
        addressId: buyer.addressId,
        status: pick(statuses),
        totalCents,
        createdAt: randomRecentDate(30),
        items: {
          create: orderItems.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
            unitPriceCents: item.priceCents,
          })),
        },
      },
    })
  }

  // 6) Reviews — evita duplicar (produto, usuário) já existente
  const REVIEW_TARGET = 20
  const existingReviewCount = await prisma.review.count()
  const reviewsToCreate = Math.max(0, REVIEW_TARGET - existingReviewCount)
  const allProducts = Object.values(productsByStore).flat()

  let attempts = 0
  let reviewsCreated = 0
  while (reviewsCreated < reviewsToCreate && attempts < reviewsToCreate * 5) {
    attempts += 1
    const product = pick(allProducts)
    const buyer = pick(buyers)

    const already = await prisma.review.findFirst({ where: { productId: product.id, userId: buyer.id } })
    if (already) continue

    await prisma.review.create({
      data: {
        productId: product.id,
        userId: buyer.id,
        rating: randomInt(3, 5),
        comment: pick(REVIEW_COMMENTS),
        createdAt: randomRecentDate(30),
      },
    })
    reviewsCreated += 1
  }

  // Resumo final
  const [userCount, storeCount, productCount, orderCount, reviewCount, addressCount] = await Promise.all([
    prisma.user.count(),
    prisma.store.count(),
    prisma.product.count(),
    prisma.order.count(),
    prisma.review.count(),
    prisma.address.count(),
  ])

  console.log('--- Resumo do seed ---')
  console.log(`Admin: ${admin.email}`)
  console.log(`Usuários (total): ${userCount}`)
  console.log(`Lojas: ${storeCount}`)
  console.log(`Produtos: ${productCount} (criados agora: ${productsCreated}, reaproveitados: ${productsReused})`)
  console.log(`Endereços: ${addressCount}`)
  console.log(`Pedidos: ${orderCount} (criados agora: ${ordersToCreate})`)
  console.log(`Avaliações: ${reviewCount} (criadas agora: ${reviewsCreated})`)
  console.log(`Senha padrão de todos os usuários de seed: ${SEED_PASSWORD}`)
}

main()
  .catch((error) => {
    console.error('Falha ao executar o seed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
