import { describe, expect, it, vi } from 'vitest'

import { isCompleteCep, lookupCep } from './cep'

const jsonResponse = (body: unknown, ok = true) =>
  ({ ok, json: () => Promise.resolve(body) }) as unknown as Response

describe('isCompleteCep', () => {
  it('aceita 8 dígitos com ou sem máscara', () => {
    expect(isCompleteCep('01310-100')).toBe(true)
    expect(isCompleteCep('01310100')).toBe(true)
  })

  it('rejeita CEP incompleto', () => {
    expect(isCompleteCep('01310')).toBe(false)
    expect(isCompleteCep('')).toBe(false)
  })
})

describe('lookupCep', () => {
  it('consulta a ViaCEP com o CEP sem máscara e mapeia o endereço', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        logradouro: 'Avenida Paulista',
        bairro: 'Bela Vista',
        localidade: 'São Paulo',
        uf: 'SP',
      }),
    )

    const result = await lookupCep('01310-100', fetchMock)

    expect(fetchMock).toHaveBeenCalledWith('https://viacep.com.br/ws/01310100/json/')
    expect(result).toEqual({
      street: 'Avenida Paulista',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
    })
  })

  it('devolve null para CEP inexistente (erro: true da ViaCEP)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ erro: true }))
    expect(await lookupCep('99999-999', fetchMock)).toBeNull()
  })

  it('devolve null para CEP incompleto sem chamar a rede', async () => {
    const fetchMock = vi.fn()
    expect(await lookupCep('123', fetchMock)).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('degrada para null em falha de rede ou resposta não-ok', async () => {
    expect(await lookupCep('01310-100', vi.fn().mockRejectedValue(new Error('offline')))).toBeNull()
    expect(await lookupCep('01310-100', vi.fn().mockResolvedValue(jsonResponse({}, false)))).toBeNull()
  })

  it('campos ausentes viram string vazia (CEP de cidade única)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ localidade: 'Monte Verde', uf: 'MG' }))
    expect(await lookupCep('37653-000', fetchMock)).toEqual({
      street: '',
      neighborhood: '',
      city: 'Monte Verde',
      state: 'MG',
    })
  })
})
