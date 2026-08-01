import { describe, expect, it } from 'vitest'
import { avatarImage, fallbackTo, localImage, productImage, storeImage } from './images'

describe('images', () => {
  describe('determinismo', () => {
    it('a mesma entidade recebe sempre a mesma URL', () => {
      expect(productImage('Ventilador')).toBe(productImage('Ventilador'))
      expect(storeImage('Loja Vizinhança')).toBe(storeImage('Loja Vizinhança'))
      expect(avatarImage('Ana Paula')).toBe(avatarImage('Ana Paula'))
    })

    it('entidades diferentes recebem URLs diferentes', () => {
      expect(productImage('Ventilador')).not.toBe(productImage('Smartwatch'))
      expect(avatarImage('Ana Paula')).not.toBe(avatarImage('Bruno Costa'))
    })

    it('normaliza acento, caixa e espaco no seed', () => {
      expect(productImage('Farmácia Local')).toContain('/farmacia-local/')
      expect(productImage('FARMACIA LOCAL')).toBe(productImage('farmácia local'))
    })

    it('nao deixa hifen sobrando nas bordas do seed', () => {
      expect(productImage('  Painel de TV!  ')).toContain('/painel-de-tv/')
    })

    it('produto e loja com o mesmo nome nao colidem', () => {
      expect(productImage('Tech Shop')).not.toBe(storeImage('Tech Shop'))
    })
  })

  describe('formato das URLs', () => {
    it('produto pede imagem quadrada no tamanho informado', () => {
      expect(productImage('Whey', 200)).toBe('https://picsum.photos/seed/whey/200/200')
    })

    it('loja pede imagem panoramica', () => {
      expect(storeImage('Mercado', 640, 360)).toBe('https://picsum.photos/seed/mercado-loja/640/360')
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
      const img = { dataset: {}, src: 'https://picsum.photos/seed/x/400/400' }
      fallbackTo('Ventilador')({ currentTarget: img })
      expect(img.src).toMatch(/^data:image\/svg\+xml/)
    })

    it('fallbackTo nao entra em laco se o proprio fallback falhar', () => {
      const img = { dataset: {}, src: 'https://picsum.photos/seed/x/400/400' }
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
        (source) => source.includes('picsum.photos') || source.includes('api.dicebear.com'),
      )

      expect(offenders).toHaveLength(0)
    })
  })
})

describe('catalogo usa as fontes centralizadas', () => {
  it('todo produto, loja e cliente tem imagem valida', async () => {
    const { products, stores, customers } = await import('../data/catalog')
    const isUsable = (url) => typeof url === 'string' && /^(https:\/\/|data:image)/.test(url)

    expect(products.length).toBeGreaterThan(0)
    products.forEach((product) => expect(isUsable(product.image)).toBe(true))
    stores.forEach((store) => expect(isUsable(store.cover)).toBe(true))
    customers.forEach((customer) => expect(isUsable(customer.avatar)).toBe(true))
  })

  it('nao ha imagem duplicada entre produtos', async () => {
    const { products } = await import('../data/catalog')
    const urls = products.map((product) => product.image)
    expect(new Set(urls).size).toBe(urls.length)
  })
})
