import { normalizeSearchTerm } from './normalizeSearch'

describe('normalizeSearchTerm', () => {
  it('remove acentos', () => {
    expect(normalizeSearchTerm('maçã')).toBe('maca')
    expect(normalizeSearchTerm('Pão de Queijo')).toBe('pao de queijo')
  })

  it('remove pontuação, mantendo espaços', () => {
    expect(normalizeSearchTerm('maça!')).toBe('maca')
    expect(normalizeSearchTerm('café-com-leite')).toBe('cafecomleite')
    expect(normalizeSearchTerm('R$ 10,00')).toBe('r 1000')
  })

  it('trata ç como c', () => {
    expect(normalizeSearchTerm('açúcar')).toBe('acucar')
  })

  it('colapsa múltiplos espaços não é feito, mas preserva espaços simples', () => {
    expect(normalizeSearchTerm('maçã  gala')).toBe('maca  gala')
  })

  it('ignora caixa (maiúsculas/minúsculas)', () => {
    expect(normalizeSearchTerm('MACA')).toBe('maca')
    expect(normalizeSearchTerm('MaÇã')).toBe('maca')
  })

  it('exemplos do requisito encontram o mesmo termo normalizado', () => {
    const target = normalizeSearchTerm('Maçã Gala')
    expect(normalizeSearchTerm('maça!')).toBe('maca')
    expect(target).toContain(normalizeSearchTerm('maça!'))
    expect(target).toContain(normalizeSearchTerm('MACA'))
    expect(target).toContain(normalizeSearchTerm('maçã'))
  })

  it('string vazia permanece vazia', () => {
    expect(normalizeSearchTerm('')).toBe('')
  })
})
