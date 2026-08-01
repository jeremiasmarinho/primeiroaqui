import { describe, expect, it } from 'vitest'
import { avatarImage, fallbackTo, localImage, productImage, storeImage } from './images'

describe('images', () => {
  describe('determinismo', () => {
    it('a mesma entidade recebe sempre a mesma URL', () => {
      expect(productImage(['fan'], 'ventilador')).toBe(productImage(['fan'], 'ventilador'))
      expect(storeImage(['shop'], 'loja')).toBe(storeImage(['shop'], 'loja'))
      expect(avatarImage('Ana Paula')).toBe(avatarImage('Ana Paula'))
    })

    it('seeds diferentes recebem fotos diferentes mesmo com a mesma palavra-chave', () => {
      expect(productImage(['fan'], 'ventilador-a')).not.toBe(productImage(['fan'], 'ventilador-b'))
      expect(avatarImage('Ana Paula')).not.toBe(avatarImage('Bruno Costa'))
    })

    it('normaliza acento, caixa e espaco no seed', () => {
      // Picsum usa seed para determinismo, não keywords. O seed é normalizado.
      const url1 = productImage(['Farmácia'], 'Farmácia')
      const url2 = productImage(['FARMACIA'], 'farmácia')
      expect(url1).toBe(url2)
      expect(url1).toContain('/seed/farmacia/')
    })

    it('nao deixa hifen sobrando nas bordas do seed', () => {
      // O seed é normalizado para remover hífens das bordas
      const url = productImage(['TV'], '  Painel de TV!  ')
      expect(url).toContain('/seed/painel-de-tv/')
    })

    it('produto e loja com o mesmo nome nao colidem', () => {
      expect(productImage(['shop'], 'Tech Shop')).not.toBe(storeImage(['shop'], 'Tech Shop'))
    })
  })

  describe('formato das URLs', () => {
    it('produto pede imagem quadrada no tamanho informado', () => {
      expect(productImage(['whey'], 'whey', 200)).toMatch(
        /^https:\/\/picsum\.photos\/seed\/whey\/200\/200$/,
      )
    })

    it('loja pede imagem panoramica', () => {
      expect(storeImage(['grocery'], 'mercado', 640, 360)).toMatch(
        /^https:\/\/picsum\.photos\/seed\/mercado-loja\/640\/360$/,
      )
    })

    it('varias palavras-chave existem para compatibilidade mas nao afetam a URL', () => {
      // Picsum usa seed para determinismo, não busca temática
      // Múltiplas keywords não mudam o resultado
      const url = productImage(['electric', 'fan'], 'ventilador')
      expect(url).toBe(productImage(['fan'], 'ventilador'))
    })

    it('avatar usa estilo ilustrado, nao foto de pessoa real', () => {
      const url = avatarImage('Ana')
      expect(url).toContain('dicebear')
      expect(url).toContain('avataaars')
      expect(url).toContain('seed=ana')
    })
  })

  describe('fallback local', () => {
    it('localImage devolve data URI de SVG', () => {
      expect(localImage('Teste')).toMatch(/^data:image\/svg\+xml;utf8,/)
    })

    it('localImage embute as iniciais e o rotulo', () => {
      const decoded = decodeURIComponent(localImage('Ventilador'))
      expect(decoded).toContain('>VE<')
      expect(decoded).toContain('>Ventilador<')
    })

    it('fallbackTo troca a src pelo placeholder local', () => {
      const img: { dataset: Record<string, string>; src: string } = { dataset: {}, src: 'https://picsum.photos/seed/ventilador/400/400' }
      fallbackTo('Ventilador')({ currentTarget: img })
      expect(img.src).toMatch(/^data:image\/svg\+xml/)
    })

    it('fallbackTo nao entra em laco se o proprio fallback falhar', () => {
      const img: { dataset: Record<string, string>; src: string } = { dataset: {}, src: 'https://picsum.photos/seed/ventilador/400/400' }
      const handler = fallbackTo('Ventilador')

      handler({ currentTarget: img })
      const afterFirst = img.src

      handler({ currentTarget: img })
      expect(img.src).toBe(afterFirst)
      expect(img.dataset.fallbackApplied).toBe('true')
    })
  })

  describe('isolamento do provedor', () => {
    it('nenhum componente monta URL de imagem por conta propria', async () => {
      // O acoplamento com o provedor mora so aqui; se vazar para os
      // componentes, trocar de banco de imagens deixa de ser trivial.
      const modules = import.meta.glob('../{components,screens}/*.jsx', {
        query: '?raw',
        import: 'default',
      })

      const sources = await Promise.all(Object.values(modules).map((load) => load()))
      const offenders = sources.filter(
        (source) => source.includes('picsum.photos') || source.includes('loremflickr.com') || source.includes('api.dicebear.com'),
      )

      expect(offenders).toHaveLength(0)
    })
  })
})

describe('catalogo usa as fontes centralizadas', () => {
  it('todo produto, loja e cliente tem imagem valida', async () => {
    const { products, stores, reviews, customerById } = await import('../data/catalog')
    const isUsable = (url: string) => typeof url === 'string' && /^(https:\/\/|data:image)/.test(url)

    expect(products.length).toBeGreaterThan(0)
    products.forEach((product) => expect(isUsable(product.image)).toBe(true))
    stores.forEach((store) => expect(isUsable(store.cover)).toBe(true))

    // `customers` e privado; o acesso publico e por id.
    reviews.forEach((review) => {
      const customer = customerById(review.customerId)
      expect(customer, `avaliacao sem cliente: ${review.id}`).toBeDefined()
      expect(isUsable(customer?.avatar ?? '')).toBe(true)
    })
  })

  it('nao ha imagem duplicada entre produtos', async () => {
    const { products } = await import('../data/catalog')
    const urls = products.map((product) => product.image)
    expect(new Set(urls).size).toBe(urls.length)
  })
})
