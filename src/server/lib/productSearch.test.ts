import { sanitizeSearchTerm } from './productSearch'

describe('sanitizeSearchTerm', () => {
  it('remove pontuação e símbolos, mantendo letras/números/espaços', () => {
    expect(sanitizeSearchTerm('couvê!')).toBe('couvê')
    expect(sanitizeSearchTerm('R$ 10,00')).toBe('R 10 00')
  })

  it('neutraliza os wildcards do LIKE (% e _)', () => {
    expect(sanitizeSearchTerm('100%_off')).toBe('100 off')
  })

  it('colapsa espaços múltiplos e remove espaço nas pontas', () => {
    expect(sanitizeSearchTerm('  maçã   gala!!  ')).toBe('maçã gala')
  })

  it('string só com símbolos vira vazia', () => {
    expect(sanitizeSearchTerm('!!!___%%%')).toBe('')
  })
})
