import { readStoredJSON, writeStoredJSON } from './storage'

describe('storage helpers', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('retorna fallback quando chave nao existe', () => {
    expect(readStoredJSON('missing', { ok: true })).toEqual({ ok: true })
  })

  it('retorna fallback quando json invalido', () => {
    localStorage.setItem('broken', '{invalid')
    expect(readStoredJSON('broken', [])).toEqual([])
  })

  it('retorna parse quando json valido', () => {
    localStorage.setItem('user', JSON.stringify({ name: 'Ana' }))
    expect(readStoredJSON('user', null)).toEqual({ name: 'Ana' })
  })

  it('retorna fallback quando shape invalido', () => {
    localStorage.setItem('user', JSON.stringify({ role: 1 }))
    const validator = (value) => typeof value?.name === 'string'
    expect(readStoredJSON('user', { name: 'Fallback' }, validator)).toEqual({ name: 'Fallback' })
  })

  it('grava null removendo chave', () => {
    writeStoredJSON('session', { token: 'x' })
    writeStoredJSON('session', null)
    expect(localStorage.getItem('session')).toBeNull()
  })

  it('grava objeto serializado', () => {
    writeStoredJSON('session', { token: 'x' })
    expect(localStorage.getItem('session')).toBe(JSON.stringify({ token: 'x' }))
  })
})
