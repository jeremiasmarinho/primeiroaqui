// Anexa fotos livres (Openverse, CC0) aos produtos do seed que ainda nao tem
// ProductPhoto. Reusa a infra de upload/thumb existente em
// src/server/lib/productPhotoStorage.ts (mesmo bucket, mesmo pipeline sharp
// usado pela rota POST /products/:id/photos) — nao reimplementa upload.
//
// Idempotente: produto que ja tem foto REAL (nao placeholder de seed) e
// pulado. Rodar de novo nao duplica nem refaz trabalho. Placeholders de seed
// (path "seed/..." ou url picsum.photos) sao sempre candidatos a
// substituicao — a foto e trocada via update (nao delete+create).
//
// Uso:
//   npm run db:photos                          -> carrega .env.local (padrao)
//   npm run db:photos -- --env .env.production   -> aponta para outro ambiente
//   npm run db:photos -- --redo cenoura --redo mamao
//     -> forca reprocessamento de produtos especificos mesmo que ja tenham
//        foto real (corrige matches ruins ja publicados), por substring
//        case-insensitive do titulo. Repetivel.
//
// Fonte de imagens: Openverse API (https://api.openverse.org/v1/images/),
// sem chave de API, filtrado por license=cc0. Rate limit anonimo e generoso
// mas nao documentado com precisao — usamos delay de 1.5s entre requests e
// retry simples em 429.

import { config as loadEnv } from 'dotenv'

// --env precisa ser lido e aplicado ANTES de importar prismaClient/supabaseClient,
// que leem process.env no top-level do modulo (mesmo padrao de prisma/seed.ts).
const envFlagIndex = process.argv.indexOf('--env')
const envFile = envFlagIndex !== -1 ? process.argv[envFlagIndex + 1] : '.env.local'
if (!envFile) {
  throw new Error('--env foi passado sem valor')
}
loadEnv({ path: envFile, quiet: true })

const { prisma } = await import('../src/server/lib/prismaClient')
const { supabaseAdmin } = await import('../src/server/lib/supabaseClient')
const sharpModule = await import('sharp')
const sharp = sharpModule.default
const {
  buildStoragePath,
  buildThumbStoragePath,
  ensureProductPhotosBucket,
  PRODUCT_PHOTOS_BUCKET,
} = await import('../src/server/lib/productPhotoStorage')

const THUMB_WIDTH = 400
const MIN_DIMENSION = 300
const OPENVERSE_DELAY_MS = 1500
const OPENVERSE_MAX_RETRIES = 3
// Mesmo limite do bucket product-photos / validateProductPhoto (5MB).
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

/**
 * Mapa curado titulo do produto (pt-BR, exatamente como em prisma/seed.ts)
 * -> lista de termos de busca em ingles para o Openverse, em ordem de
 * preferencia. Curadoria manual — produto sem entrada aqui e pulado com
 * aviso (nunca traduzido automaticamente). Quando o 1o termo nao acha
 * candidato adequado, tenta o proximo da lista (sinonimos mais genericos/
 * fotograficos tendem a ter mais acervo CC0 no Openverse do que termos
 * compostos e especificos).
 */
const SEARCH_TERMS: Record<string, string[]> = {
  // Supermercado — Mercearia do Bairro
  'Arroz Branco Tipo 1 5kg': ['white rice bag'],
  'Feijão Carioca 1kg': ['pinto beans bag', 'pinto beans', 'beans'],
  'Óleo de Soja 900ml': ['soybean cooking oil bottle', 'cooking oil bottle', 'vegetable oil bottle'],
  'Açúcar Refinado 1kg': ['white sugar bag'],
  'Café Torrado e Moído 500g': ['ground coffee bag'],
  'Leite Integral 1L': ['milk carton', 'milk bottle', 'glass of milk'],
  'Papel Higiênico 12 Rolos': ['toilet paper rolls'],
  'Detergente Neutro 500ml': ['dish soap bottle'],
  'Macarrão Espaguete 500g': ['spaghetti pasta package', 'spaghetti', 'pasta'],
  'Refrigerante Cola 2L': ['cola soda bottle'],

  // Farmácia Vida Nova
  'Dipirona Sódica 500mg 10 Comprimidos': ['pills blister pack'],
  'Álcool em Gel 70% 500ml': ['hand sanitizer gel bottle'],
  'Protetor Solar FPS 60 120ml': ['sunscreen bottle'],
  'Vitamina C 1g 30 Comprimidos': ['vitamin c tablets', 'supplement pills', 'vitamin c tablets bottle'],
  'Fralda Geriátrica Pacote com 8': ['adult diapers package', 'adult diapers', 'diapers'],
  'Termômetro Digital': ['digital thermometer fever', 'clinical thermometer', 'digital thermometer'],
  'Soro Fisiológico 500ml': ['saline solution bottle', 'iv drip bag', 'saline solution'],
  'Máscara Descartável Caixa com 50': ['surgical mask', 'medical face mask'],
  'Pomada para Assaduras 45g': ['diaper rash cream tube', 'diaper cream', 'ointment tube'],
  'Shampoo Anticaspa 200ml': ['anti dandruff shampoo bottle', 'shampoo bottle', 'hair shampoo'],

  // Padaria São José
  'Pão Francês (kg)': ['bread rolls'],
  'Pão de Queijo Assado (dúzia)': ['brazilian cheese bread'],
  'Bolo de Fubá Caseiro': ['cornmeal cake', 'corn cake', 'pound cake'],
  'Croissant de Presunto e Queijo': ['ham and cheese croissant'],
  'Baguete Artesanal': ['artisan baguette bread'],
  'Torta de Frango (fatia)': ['chicken pie slice'],
  'Sonho Recheado': ['filled doughnut'],
  'Pão Integral Fatiado 500g': ['sliced whole wheat bread'],
  'Café Expresso': ['espresso shot cup', 'espresso coffee cup'],
  'Suco Natural de Laranja 300ml': ['glass of orange juice', 'fresh orange juice glass'],

  // Petshop Amigo Fiel
  'Ração Cães Adultos 10,1kg': ['dog food bag'],
  'Ração Gatos Castrados 3kg': ['cat food bag'],
  'Areia Higiênica para Gatos 4kg': ['kitty litter', 'cat litter tray', 'cat litter sand', 'cat litter'],
  'Petisco Sachê Cães 85g': ['dog treats', 'dog snack'],
  'Shampoo Pet Neutro 500ml': ['dog shampoo bottle', 'dog bath tub washing pet', 'pet grooming shampoo'],
  'Coleira Ajustável Nylon': ['nylon dog collar', 'dog collar product', 'dog collar'],
  'Brinquedo Mordedor para Cães': ['dog chew toy rubber', 'dog toy ball', 'dog chew toy'],
  'Caixa de Areia Sanitária': ['cat litter box plastic', 'litter tray cat', 'cat litter box'],
  'Petisco Bifinho Cães 500g': ['dog jerky treat', 'dog snack food', 'dog jerky treats'],
  'Tapete Higiênico Pacote com 30': ['pee pads package', 'puppy pads', 'pee pads'],

  // Hortifruti Flor do Campo
  'Banana Prata (kg)': ['bananas'],
  'Maçã Gala (kg)': ['gala apples'],
  'Tomate Salada (kg)': ['tomatoes'],
  'Alface Crespa (unidade)': ['curly lettuce'],
  'Cebola (kg)': ['onions'],
  'Batata Inglesa (kg)': ['potatoes', 'raw potato pile'],
  'Laranja Pera (kg)': ['oranges citrus fruit', 'orange fruit basket', 'oranges'],
  'Cenoura (kg)': ['carrots'],
  'Mamão Papaya (unidade)': ['papaya fruit'],
  'Couve Manteiga (maço)': ['collard greens'],
}

type OpenverseResult = {
  id: string
  title?: string
  url: string
  thumbnail?: string
  width?: number
  height?: number
  creator?: string
  license?: string
  license_url?: string
  foreign_landing_url?: string
  tags?: { name: string }[]
}

type OpenverseResponse = {
  result_count: number
  results: OpenverseResult[]
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Busca no Openverse com retry simples em 429 (backoff fixo). */
async function searchOpenverse(term: string, perPage: number): Promise<OpenverseResult[]> {
  const url = new URL('https://api.openverse.org/v1/images/')
  url.searchParams.set('q', term)
  url.searchParams.set('license', 'cc0')
  url.searchParams.set('per_page', String(perPage))

  for (let attempt = 1; attempt <= OPENVERSE_MAX_RETRIES; attempt++) {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'primeiro-aqui-mvp/attach-seed-photos (dev script)' },
    })

    if (response.status === 429) {
      const waitMs = OPENVERSE_DELAY_MS * attempt * 2
      console.warn(`  [429] Rate limited buscando "${term}" — aguardando ${waitMs}ms (tentativa ${attempt})`)
      await sleep(waitMs)
      continue
    }

    if (!response.ok) {
      throw new Error(`Openverse respondeu ${response.status} para "${term}"`)
    }

    const data = (await response.json()) as OpenverseResponse
    return data.results ?? []
  }

  throw new Error(`Excedeu tentativas de retry (429) buscando "${term}"`)
}

// Palavras curtas/genericas demais para servir de sinal de relevancia
// (ex.: "bag", "bottle" sozinhas aceitariam quase qualquer coisa embalada).
const RELEVANCE_STOPWORDS = new Set([
  'a', 'an', 'the', 'of', 'for', 'and', 'with', 'in', 'on',
  'bag', 'bottle', 'box', 'package', 'pack', 'pouch', 'tube', 'jar', 'can', 'cup', 'glass',
])

// Palavras curtas (<4 letras) que sao identificadores de dominio fortes e
// NAO devem ser descartadas so por serem curtas — "dog"/"cat"/"pet" sao mais
// discriminativas que muita palavra de 4+ letras (ex.: "wash", "bath").
const CORE_IDENTIFIER_ALLOWLIST = new Set(['dog', 'cat', 'pet'])

/**
 * Extrai palavras-chave de um termo de busca, separadas em:
 * - core: identificadores fortes de dominio (dog/cat/pet) presentes no termo.
 * - other: demais palavras "significativas" (>=4 letras, fora da stopword list).
 * Quando o termo tem um core identifier, o candidato PRECISA casar com ele
 * (nao basta casar com uma palavra generica tipo "washing" ou "treats" —
 * evita, por ex., "dog bath washing" casando com uma gravura de "Matlock
 * Bath" so pela palavra "washing").
 */
function relevanceKeywords(term: string): { core: string[]; other: string[] } {
  const words = term.toLowerCase().split(/\s+/)
  const core = words.filter((w) => CORE_IDENTIFIER_ALLOWLIST.has(w))
  const other = words.filter((w) => w.length >= 4 && !RELEVANCE_STOPWORDS.has(w))
  // Termo curto/generico demais (nada sobrou em "other" e nao ha core): usa
  // as palavras originais mesmo assim — melhor um filtro fraco do que nenhum.
  if (core.length === 0 && other.length === 0) {
    return { core: [], other: words }
  }
  return { core, other }
}

/**
 * True se o title ou alguma tag do resultado e relevante ao termo buscado.
 * Se o termo tem identificador de dominio forte (dog/cat/pet), o candidato
 * precisa casar com ELE especificamente (nao so com qualquer outra
 * palavra do termo) — regra mais rigorosa para produtos pet, onde um match
 * "generico" tende a trazer coisa fora do assunto.
 */
/**
 * Match de palavra inteira (word boundary), nao substring — essencial pros
 * identificadores curtos ("cat", "dog", "pet"), que senao dao falso positivo
 * dentro de "category", "indicate", "petition", "carpet" etc.
 */
function containsWord(haystack: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b${escaped}\\b`, 'i').test(haystack)
}

function isRelevant(result: OpenverseResult, keywords: { core: string[]; other: string[] }): boolean {
  const haystack = [result.title ?? '', ...(result.tags ?? []).map((t) => t.name)]
    .join(' ')
    .toLowerCase()
  if (!haystack.trim()) return false

  if (keywords.core.length > 0) {
    return keywords.core.some((k) => containsWord(haystack, k))
  }
  return keywords.other.some((k) => haystack.includes(k))
}

// Openverse tem muito acervo de arte/ilustracao/gravura antiga sob CC0
// (museus, wikimedia) que passa no filtro de relevancia por palavra-chave
// mas nao serve pra foto de produto de e-commerce. Rejeita esses candidatos
// mesmo que o title/tags contenha a keyword buscada.
const ILLUSTRATION_MARKERS = [
  'drawing', 'illustration', 'engraving', 'clipart', 'clip art',
  'cartoon', 'sketch', 'vector', 'painting', 'print',
  'sticker', 'png sticker', 'icon', 'graphic element', 'collage element',
  'monochrome', 'black and white', 'vintage photograph',
]

function isIllustration(result: OpenverseResult): boolean {
  const haystack = [result.title ?? '', ...(result.tags ?? []).map((t) => t.name)]
    .join(' ')
    .toLowerCase()
  return ILLUSTRATION_MARKERS.some((marker) => haystack.includes(marker))
}

/**
 * Validador extra, por produto, para reforcar relevancia alem do filtro
 * generico de keywords — usado quando uma unica palavra (ex.: "orange", que
 * serve tanto pra fruta quanto pra cor) gera falsos positivos recorrentes
 * (ex.: cogumelo laranja para "Laranja Pera"). Recebe o title (isolado das
 * tags de proposito — tags do Openverse sao geradas por classificador de
 * imagem e podem conter frases tao ruidosas quanto "cat litter" numa foto de
 * brinco de ouro inca; exigir o termo no TITLE e muito mais confiavel).
 * Chave = titulo exato do produto no seed.
 */
const EXTRA_VALIDATORS: Record<string, (title: string) => boolean> = {
  'Laranja Pera (kg)': (title) => title.includes('orange') && (title.includes('fruit') || title.includes('citrus')),
  'Areia Higiênica para Gatos 4kg': (title) => containsWord(title, 'litter'),
  'Caixa de Areia Sanitária': (title) => containsWord(title, 'litter'),
}

/**
 * Escolhe o melhor resultado: precisa (a) ter dimensoes >= MIN_DIMENSION,
 * (b) ter title/tags relevantes ao termo buscado (evita matches "cegos" tipo
 * um robo de LEGO para "carrot" so porque e laranja), (c) nao ser arte/
 * ilustracao/gravura/foto p&b antiga (queremos foto de produto), e (d)
 * passar no validador extra do produto (contra o TITLE), se houver. Entre os
 * candidatos validos, prefere o de maior area (mais provavel ser foto de
 * produto real, nao thumbnail minusculo).
 */
function pickResult(
  results: OpenverseResult[],
  term: string,
  extraValidator?: (title: string) => boolean,
): OpenverseResult | undefined {
  const keywords = relevanceKeywords(term)
  const candidates = results.filter((r) => {
    if (!r.url) return false
    const widthOk = r.width === undefined || r.width >= MIN_DIMENSION
    const heightOk = r.height === undefined || r.height >= MIN_DIMENSION
    if (!widthOk || !heightOk) return false
    if (!isRelevant(r, keywords)) return false
    if (isIllustration(r)) return false
    if (extraValidator && !extraValidator((r.title ?? '').toLowerCase())) return false
    return true
  })
  if (candidates.length === 0) return undefined
  return candidates.reduce((best, current) => {
    const bestArea = (best.width ?? 0) * (best.height ?? 0)
    const currentArea = (current.width ?? 0) * (current.height ?? 0)
    return currentArea > bestArea ? current : best
  })
}

/**
 * Busca um termo com escalonamento: tenta per_page=5 primeiro; se nenhum
 * candidato relevante e de dimensao adequada aparecer, tenta de novo com
 * per_page=10 antes de desistir do termo.
 */
async function searchOpenverseWithFallback(
  term: string,
  extraValidator?: (title: string) => boolean,
): Promise<OpenverseResult | undefined> {
  const firstBatch = await searchOpenverse(term, 5)
  await sleep(OPENVERSE_DELAY_MS)
  const picked = pickResult(firstBatch, term, extraValidator)
  if (picked) return picked

  console.log(`  [relevancia] Nenhum match relevante em 5 resultados para "${term}" — tentando per_page=10`)
  const secondBatch = await searchOpenverse(term, 10)
  await sleep(OPENVERSE_DELAY_MS)
  return pickResult(secondBatch, term, extraValidator)
}

async function downloadImage(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Download falhou (${response.status}) para ${url}`)
  }
  const contentType = response.headers.get('content-type') ?? 'image/jpeg'
  const arrayBuffer = await response.arrayBuffer()
  return { buffer: Buffer.from(arrayBuffer), contentType }
}

const SUPPORTED_UPLOAD_TYPES: Record<string, string> = {
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/png': 'image/png',
  'image/webp': 'image/webp',
}

/**
 * Flag --redo <termo-parcial>, repetivel: forca reprocessamento de produtos
 * cujo titulo (case-insensitive) contem o termo, mesmo que ja tenham foto
 * "real" no bucket. Uso: corrigir matches ruins ja publicados (ex.:
 * `--redo cenoura --redo mamao`) sem precisar apagar registros na mao.
 */
function parseRedoFlags(argv: string[]): string[] {
  const values: string[] = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--redo') {
      const value = argv[i + 1]
      if (value) values.push(normalizeForMatch(value))
    }
  }
  return values
}

/** Minusculo + sem acentos, para comparar "mamao" com "Mamão" sem exigir digitar acento no --redo. */
function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

async function main() {
  console.log(`attach-seed-photos iniciado — env carregado de "${envFile}"`)

  const redoTerms = parseRedoFlags(process.argv)
  if (redoTerms.length > 0) {
    console.log(`--redo ativo para: ${redoTerms.join(', ')}`)
  }

  const products = await prisma.product.findMany({
    select: { id: true, title: true, storeId: true },
    orderBy: { title: 'asc' },
  })

  let withRealPhoto = 0
  let replaced = 0
  let noResult = 0
  let errors = 0
  let skippedNoTerm = 0
  const attachedUrls: { title: string; url: string }[] = []

  await ensureProductPhotosBucket()
  const bucket = supabaseAdmin.storage.from(PRODUCT_PHOTOS_BUCKET)

  for (const product of products) {
    const existing = await prisma.productPhoto.findFirst({ where: { productId: product.id } })

    // prisma/seed.ts cria um ProductPhoto placeholder (picsum.photos) para
    // TODO produto, com path prefixado "seed/". Isso nao conta como "ja tem
    // foto real" — o objetivo deste script e justamente substituir esses
    // placeholders por imagens reais do Openverse. So pula quando a foto
    // existente ja foi enviada de verdade ao bucket product-photos (path que
    // nao comeca com "seed/" e url que nao aponta para picsum.photos) E o
    // produto nao foi marcado para reprocessamento via --redo.
    const isPlaceholder = existing
      ? existing.path.startsWith('seed/') || existing.url.includes('picsum.photos')
      : false
    const forcedRedo = redoTerms.some((t) => normalizeForMatch(product.title).includes(t))

    if (existing && !isPlaceholder && !forcedRedo) {
      withRealPhoto += 1
      console.log(`[skip] "${product.title}" ja tem foto real no bucket (idempotente).`)
      continue
    }
    if (existing && !isPlaceholder && forcedRedo) {
      console.log(`[redo] "${product.title}" marcado para reprocessamento forcado (--redo).`)
    }

    const terms = SEARCH_TERMS[product.title]
    if (!terms || terms.length === 0) {
      skippedNoTerm += 1
      console.warn(`[aviso] "${product.title}" nao tem termo de busca mapeado — pulando.`)
      continue
    }

    const extraValidator = EXTRA_VALIDATORS[product.title]

    try {
      let chosen: OpenverseResult | undefined
      let usedTerm = ''
      for (const term of terms) {
        console.log(`[busca] "${product.title}" -> "${term}"`)
        chosen = await searchOpenverseWithFallback(term, extraValidator)
        if (chosen) {
          usedTerm = term
          break
        }
        console.warn(`  [sem-match] "${term}" nao trouxe candidato relevante/valido — tentando proximo termo, se houver.`)
      }

      if (!chosen) {
        noResult += 1
        console.warn(`[sem-resultado] Nenhuma imagem adequada para "${product.title}" (termos tentados: ${terms.join(', ')})`)
        continue
      }

      console.log(
        `  termo usado: "${usedTerm}" | titulo openverse: ${chosen.title ?? 'n/d'} | origem: ${chosen.foreign_landing_url ?? chosen.url} | creator: ${chosen.creator ?? 'desconhecido'} | license_url: ${chosen.license_url ?? 'n/d'}`,
      )

      const { buffer: downloaded, contentType } = await downloadImage(chosen.url)
      let normalizedType = SUPPORTED_UPLOAD_TYPES[contentType.split(';')[0]?.trim() ?? '']
      if (!normalizedType) {
        errors += 1
        console.warn(`[erro] Formato nao suportado (${contentType}) para "${product.title}" — pulando.`)
        continue
      }

      // Bucket product-photos tem limite de 5MB (mesmo limite de
      // validateProductPhoto). Alguns originais do Openverse (Wikimedia,
      // Flickr em alta resolucao) excedem isso — reduz e reencoda como jpeg
      // em vez de descartar o produto.
      let buffer = downloaded
      if (buffer.byteLength > MAX_UPLOAD_BYTES) {
        try {
          buffer = await sharp(downloaded).resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer()
          normalizedType = 'image/jpeg'
          console.log(`  [resize] Original de ${downloaded.byteLength} bytes excedia limite — reduzido para ${buffer.byteLength} bytes.`)
        } catch {
          errors += 1
          console.warn(`[erro] Imagem grande demais e sharp falhou ao reduzir para "${product.title}" — pulando.`)
          continue
        }
      }

      let thumbBuffer: Buffer
      try {
        thumbBuffer = await sharp(buffer).resize({ width: THUMB_WIDTH, withoutEnlargement: true }).toBuffer()
      } catch {
        errors += 1
        console.warn(`[erro] Imagem invalida (sharp falhou) para "${product.title}" — pulando.`)
        continue
      }

      const path = buildStoragePath(product.id, normalizedType)
      const thumbPath = buildThumbStoragePath(path)

      const { error: uploadError } = await bucket.upload(path, buffer, { contentType: normalizedType })
      if (uploadError) {
        errors += 1
        console.warn(`[erro] Falha ao enviar foto de "${product.title}": ${uploadError.message}`)
        continue
      }
      const { error: thumbUploadError } = await bucket.upload(thumbPath, thumbBuffer, { contentType: normalizedType })
      if (thumbUploadError) {
        await bucket.remove([path])
        errors += 1
        console.warn(`[erro] Falha ao enviar thumb de "${product.title}": ${thumbUploadError.message}`)
        continue
      }

      const { data: publicUrlData } = bucket.getPublicUrl(path)
      const { data: thumbPublicUrlData } = bucket.getPublicUrl(thumbPath)

      if (existing) {
        // Placeholder de seed: atualiza o registro existente (nao e exclusao
        // de dados, e substituicao de url/thumbUrl/path no mesmo row).
        await prisma.productPhoto.update({
          where: { id: existing.id },
          data: {
            url: publicUrlData.publicUrl,
            thumbUrl: thumbPublicUrlData.publicUrl,
            path,
            position: 0,
          },
        })
      } else {
        await prisma.productPhoto.create({
          data: {
            productId: product.id,
            url: publicUrlData.publicUrl,
            thumbUrl: thumbPublicUrlData.publicUrl,
            path,
            position: 0,
          },
        })
      }

      replaced += 1
      attachedUrls.push({ title: product.title, url: publicUrlData.publicUrl })
      console.log(
        `[ok] Foto ${existing ? 'substituida' : 'anexada'} em "${product.title}" -> ${publicUrlData.publicUrl}`,
      )
    } catch (error) {
      errors += 1
      console.error(`[erro] Falha inesperada em "${product.title}":`, error)
    }
  }

  // Cobertura final: quantos produtos do catalogo (com termo mapeado) tem
  // foto real (nao placeholder) apos esta rodada.
  const finalPhotos = await prisma.productPhoto.findMany({
    where: { productId: { in: products.map((p) => p.id) } },
    select: { productId: true, path: true, url: true },
  })
  const realPhotoProductIds = new Set(
    finalPhotos
      .filter((p) => !p.path.startsWith('seed/') && !p.url.includes('picsum.photos'))
      .map((p) => p.productId),
  )
  const mappedProductIds = new Set(products.filter((p) => SEARCH_TERMS[p.title]).map((p) => p.id))
  const mappedWithRealPhoto = [...mappedProductIds].filter((id) => realPhotoProductIds.has(id)).length
  const stillPlaceholder = mappedProductIds.size - mappedWithRealPhoto

  console.log('--- Resumo attach-seed-photos ---')
  console.log(`Produtos totais: ${products.length}`)
  console.log(`Ja tinham foto real (pulados): ${withRealPhoto}`)
  console.log(`Placeholders substituidos / fotos novas anexadas nesta rodada: ${replaced}`)
  console.log(`Sem resultado adequado no Openverse: ${noResult}`)
  console.log(`Sem termo de busca mapeado (pulados): ${skippedNoTerm}`)
  console.log(`Erros (download/upload/formato): ${errors}`)
  console.log(
    `Cobertura final (produtos com termo mapeado): ${mappedWithRealPhoto}/${mappedProductIds.size} com foto real, ${stillPlaceholder} ainda em placeholder.`,
  )
  if (attachedUrls.length > 0) {
    console.log('--- Fotos anexadas/substituidas nesta rodada ---')
    for (const item of attachedUrls) {
      console.log(`  ${item.title} -> ${item.url}`)
    }
  }
}

main()
  .catch((error) => {
    console.error('Falha ao executar attach-seed-photos:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
