import {
  MAX_SEARCH_HISTORY,
  addSearchTerm,
  clearSearchHistory,
  loadSearchHistory,
  removeSearchTerm,
  saveSearchHistory,
} from './searchHistory'
import { STORAGE_KEYS } from './session'

describe('searchHistory', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('addSearchTerm', () => {
    it('adiciona o termo mais recente no topo', () => {
      const result = addSearchTerm(['ventilador'], 'smartwatch')
      expect(result).toEqual(['smartwatch', 'ventilador'])
    })

    it('remove duplicata sem diferenciar caixa e move para o topo', () => {
      const result = addSearchTerm(['smartwatch', 'ventilador'], 'SmartWatch')
      expect(result).toEqual(['SmartWatch', 'ventilador'])
    })

    it('corta em 8 itens, descartando o mais antigo', () => {
      const history = Array.from({ length: MAX_SEARCH_HISTORY }, (_, index) => `termo-${index}`)
      const result = addSearchTerm(history, 'novo termo')

      expect(result).toHaveLength(MAX_SEARCH_HISTORY)
      expect(result[0]).toBe('novo termo')
      expect(result).not.toContain('termo-7')
    })

    it('ignora termo vazio ou só espaço', () => {
      expect(addSearchTerm(['a'], '')).toEqual(['a'])
      expect(addSearchTerm(['a'], '   ')).toEqual(['a'])
    })

    it('remove espaços nas pontas do termo salvo', () => {
      expect(addSearchTerm([], '  ventilador  ')).toEqual(['ventilador'])
    })
  })

  describe('removeSearchTerm', () => {
    it('remove o item pelo termo, sem diferenciar caixa', () => {
      const result = removeSearchTerm(['Ventilador', 'smartwatch'], 'ventilador')
      expect(result).toEqual(['smartwatch'])
    })

    it('não afeta a lista quando o termo não existe', () => {
      const result = removeSearchTerm(['ventilador'], 'inexistente')
      expect(result).toEqual(['ventilador'])
    })
  })

  describe('clearSearchHistory', () => {
    it('retorna lista vazia', () => {
      expect(clearSearchHistory()).toEqual([])
    })
  })

  describe('persistência', () => {
    it('loadSearchHistory devolve lista vazia sem nada salvo', () => {
      expect(loadSearchHistory()).toEqual([])
    })

    it('saveSearchHistory grava e loadSearchHistory lê de volta', () => {
      saveSearchHistory(['ventilador', 'smartwatch'])
      expect(loadSearchHistory()).toEqual(['ventilador', 'smartwatch'])
    })

    it('sobrevive a um "reload" simulado (nova leitura do storage)', () => {
      saveSearchHistory(['whey'])
      // Simula reabrir o app: nenhuma referência de memória é reaproveitada.
      expect(loadSearchHistory()).toEqual(['whey'])
    })

    it('dado corrompido no storage cai no fallback vazio', () => {
      localStorage.setItem(STORAGE_KEYS.searchHistory, '{isso nao e json')
      expect(loadSearchHistory()).toEqual([])
    })

    it('formato errado (nao é array de strings) cai no fallback vazio', () => {
      localStorage.setItem(STORAGE_KEYS.searchHistory, JSON.stringify({ termo: 'x' }))
      expect(loadSearchHistory()).toEqual([])
    })
  })
})
