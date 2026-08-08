import {
  CEP_ERROR_MESSAGE,
  EMPTY_ADDRESS,
  addressToDeliveryPatch,
  createAddress,
  createAddressIdGenerator,
  formatAddress,
  formatCep,
  getDefaultAddress,
  isValidCep,
  removeAddress,
  setDefaultAddress,
  validateAddressDraft,
} from './addresses'
import { makeAddress } from '../test/factories'

/**
 * WU-48 — endereços. Lógica pura: sem React, sem storage, sem relógio.
 *
 * O gerador de ID é injetado, como já é feito em `state/orders`: endereço
 * criado em teste precisa de ID previsível, e `Math.random()` no domínio
 * tornaria a suíte não determinística.
 */
describe('CEP', () => {
  it('mascara os digitos no formato 00000-000 conforme a pessoa digita', () => {
    expect(formatCep('1')).toBe('1')
    expect(formatCep('12345')).toBe('12345')
    expect(formatCep('123456')).toBe('12345-6')
    expect(formatCep('12345678')).toBe('12345-678')
  })

  it('descarta letras e digitos alem do oitavo', () => {
    expect(formatCep('12a34b5678999')).toBe('12345-678')
  })

  it('aceita 8 digitos com ou sem hifen', () => {
    expect(isValidCep('12345-678')).toBe(true)
    expect(isValidCep('12345678')).toBe(true)
  })

  it('rejeita cep curto, longo ou com caractere estranho', () => {
    expect(isValidCep('123')).toBe(false)
    expect(isValidCep('123456789')).toBe(false)
    expect(isValidCep('12345 678')).toBe(false)
    expect(isValidCep('')).toBe(false)
  })

  it('a mensagem de erro diz o formato esperado, nao so "invalido"', () => {
    expect(CEP_ERROR_MESSAGE).toMatch(/00000-000/)
    expect(CEP_ERROR_MESSAGE).toMatch(/8 digitos/i)
  })
})

describe('gerador de id de endereco', () => {
  it('continua a sequencia a partir do maior id existente', () => {
    const nextId = createAddressIdGenerator([{ id: 'end-1' }, { id: 'end-4' }])
    expect(nextId()).toBe('end-5')
    expect(nextId()).toBe('end-6')
  })

  it('ignora id fora do padrao e nao repete', () => {
    const nextId = createAddressIdGenerator([{ id: 'abc' }])
    const ids = new Set([nextId(), nextId(), nextId()])
    expect(ids.size).toBe(3)
  })
})

describe('cadastro de endereco', () => {
  const idGenerator = () => 'end-9'
  const draft = {
    label: 'Casa',
    street: 'Avenida Guanabara',
    number: '148',
    complement: '',
    neighborhood: '',
    city: 'Centro',
    state: 'SP',
    cep: '12345-678',
  }

  it('o primeiro endereco cadastrado ja nasce como padrao', () => {
    const result = createAddress([], draft, { idGenerator })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.addresses).toHaveLength(1)
    expect(result.created.isDefault).toBe(true)
    expect(result.created.id).toBe('end-9')
  })

  it('o segundo endereco nao rouba o padrao do primeiro', () => {
    const first = createAddress([], draft, { idGenerator: () => 'end-1' })
    if (!first.ok) throw new Error('primeiro cadastro deveria passar')

    const second = createAddress(
      first.addresses,
      { ...draft, label: 'Trabalho', street: 'Rua Nova, 9' },
      { idGenerator: () => 'end-2' },
    )
    if (!second.ok) throw new Error('segundo cadastro deveria passar')

    expect(second.addresses.filter((item) => item.isDefault)).toHaveLength(1)
    expect(second.addresses[0]?.isDefault).toBe(true)
  })

  it('rejeita cep invalido com mensagem de recuperacao', () => {
    const result = createAddress([], { ...draft, cep: '123' }, { idGenerator })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('cep-invalido')
    expect(result.message).toBe(CEP_ERROR_MESSAGE)
  })

  it('rejeita campos obrigatorios vazios, um motivo por vez', () => {
    const semRotulo = createAddress([], { ...draft, label: '  ' }, { idGenerator })
    const semRua = createAddress([], { ...draft, street: '' }, { idGenerator })
    const semCidade = createAddress([], { ...draft, city: '' }, { idGenerator })

    expect(semRotulo.ok === false && semRotulo.reason).toBe('rotulo-obrigatorio')
    expect(semRua.ok === false && semRua.reason).toBe('rua-obrigatoria')
    expect(semCidade.ok === false && semCidade.reason).toBe('cidade-obrigatoria')
  })

  it('rejeita endereco repetido em vez de duplicar a lista', () => {
    const first = createAddress([], draft, { idGenerator: () => 'end-1' })
    if (!first.ok) throw new Error('primeiro cadastro deveria passar')

    const repeated = createAddress(first.addresses, draft, { idGenerator: () => 'end-2' })
    expect(repeated.ok === false && repeated.reason).toBe('duplicado')
  })

  it('normaliza o cep gravado para a mascara', () => {
    const result = createAddress([], { ...draft, cep: '12345678' }, { idGenerator })
    if (!result.ok) throw new Error('cadastro deveria passar')
    expect(result.created.cep).toBe('12345-678')
  })

  it('o rascunho vazio nao tem campo preenchido', () => {
    expect(EMPTY_ADDRESS).toEqual({
      label: '',
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      cep: '',
    })
  })
})

describe('numero e complemento', () => {
  const base = {
    label: 'Casa',
    street: 'Avenida Guanabara',
    neighborhood: '',
    city: 'Centro',
    state: 'SP',
    cep: '12345-678',
  }

  it('numero presente dispensa complemento', () => {
    const result = validateAddressDraft({ ...base, number: '148', complement: '' })
    expect(result.ok).toBe(true)
  })

  it('sem numero, complemento e obrigatorio', () => {
    const result = validateAddressDraft({ ...base, number: '', complement: '' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('complemento-obrigatorio')
    expect(result.message).toMatch(/complemento/i)
  })

  it('sem numero mas com complemento (casa s/n) passa', () => {
    const result = validateAddressDraft({
      ...base,
      number: '',
      complement: 'Casa amarela, ao lado do mercado',
    })
    expect(result.ok).toBe(true)
  })
})

describe('endereco padrao', () => {
  const casa = makeAddress({ id: 'end-1', label: 'Casa', isDefault: true })
  const trabalho = makeAddress({ id: 'end-2', label: 'Trabalho', isDefault: false })

  it('definir padrao move a marca e mantem exatamente um padrao', () => {
    const list = setDefaultAddress([casa, trabalho], 'end-2')

    expect(list.filter((item) => item.isDefault)).toHaveLength(1)
    expect(list.find((item) => item.id === 'end-2')?.isDefault).toBe(true)
  })

  it('definir padrao com id inexistente nao apaga o padrao atual', () => {
    const list = setDefaultAddress([casa, trabalho], 'end-404')
    expect(list.find((item) => item.id === 'end-1')?.isDefault).toBe(true)
  })

  it('getDefaultAddress devolve o marcado, senao o primeiro, senao nulo', () => {
    expect(getDefaultAddress([casa, trabalho])?.id).toBe('end-1')
    expect(getDefaultAddress([trabalho])?.id).toBe('end-2')
    expect(getDefaultAddress([])).toBeNull()
  })

  it('remover o padrao promove o proximo da lista', () => {
    const list = removeAddress([casa, trabalho], 'end-1')

    expect(list).toHaveLength(1)
    expect(list[0]?.isDefault).toBe(true)
  })

  it('remover um endereco comum nao mexe no padrao', () => {
    const list = removeAddress([casa, trabalho], 'end-2')
    expect(list).toEqual([casa])
  })

  it('remover id inexistente devolve a lista intacta', () => {
    expect(removeAddress([casa, trabalho], 'end-404')).toHaveLength(2)
  })
})

describe('endereco no checkout', () => {
  it('vira um patch de entrega com rua, cidade e cep', () => {
    const address = makeAddress({ street: 'Rua Nova, 9', city: 'Centro', cep: '99999-000' })
    expect(addressToDeliveryPatch(address)).toEqual({
      address: 'Rua Nova, 9',
      city: 'Centro',
      cep: '99999-000',
    })
  })

  it('formata uma linha legivel para o cabecalho', () => {
    const address = makeAddress({ street: 'Avenida Guanabara, 148', city: 'Centro' })
    expect(formatAddress(address)).toBe('Avenida Guanabara, 148')
  })
})

describe('formatAddress', () => {
  it('monta rua, numero e complemento', () => {
    const address = makeAddress({ street: 'Avenida Guanabara', number: '148', complement: 'Apto 4' })
    expect(formatAddress(address)).toBe('Avenida Guanabara, 148 - Apto 4')
  })

  it('sem complemento, so rua e numero', () => {
    const address = makeAddress({ street: 'Avenida Guanabara', number: '148', complement: undefined })
    expect(formatAddress(address)).toBe('Avenida Guanabara, 148')
  })

  it('endereco legado sem numero exibe como esta, sem quebrar', () => {
    const address = makeAddress({ street: 'Avenida Guanabara, 148', number: undefined, complement: undefined })
    expect(formatAddress(address)).toBe('Avenida Guanabara, 148')
  })

  it('inclui o bairro no final quando presente', () => {
    const address = makeAddress({
      street: 'Avenida Guanabara',
      number: '148',
      complement: 'Apto 4',
      neighborhood: 'Centro',
    })
    expect(formatAddress(address)).toBe('Avenida Guanabara, 148 - Apto 4, Centro')
  })
})
