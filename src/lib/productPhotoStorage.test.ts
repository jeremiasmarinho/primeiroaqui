import {
  validateProductPhoto,
  buildStoragePath,
  StorageValidationError,
} from './productPhotoStorage'

describe('validateProductPhoto', () => {
  it('rejeita tipo de arquivo nao suportado', () => {
    expect(() => validateProductPhoto({ size: 1000, type: 'application/pdf' })).toThrow(
      StorageValidationError,
    )
  })

  it('rejeita arquivo acima do limite de tamanho', () => {
    expect(() =>
      validateProductPhoto({ size: 6 * 1024 * 1024, type: 'image/jpeg' }),
    ).toThrow(StorageValidationError)
  })

  it('aceita jpeg dentro do limite', () => {
    expect(() => validateProductPhoto({ size: 1024, type: 'image/jpeg' })).not.toThrow()
  })

  it('aceita png e webp dentro do limite', () => {
    expect(() => validateProductPhoto({ size: 1024, type: 'image/png' })).not.toThrow()
    expect(() => validateProductPhoto({ size: 1024, type: 'image/webp' })).not.toThrow()
  })
})

describe('buildStoragePath', () => {
  it('retorna path no formato <productId>/<uuid>.<ext>', () => {
    const path = buildStoragePath('produto-123', 'foto.jpg')
    expect(path).toMatch(
      /^produto-123\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/,
    )
  })

  it('usa o proprio nome do arquivo como extensao quando nao ha ponto', () => {
    // split('.').pop() nunca retorna undefined para uma string nao vazia
    // (o array sempre tem ao menos um elemento) — o fallback so protege
    // contra fileName vazio, que produz string vazia, nao undefined.
    const path = buildStoragePath('produto-123', 'foto-sem-extensao')
    expect(path.endsWith('.foto-sem-extensao')).toBe(true)
  })

  it('preserva a extensao original do arquivo', () => {
    const path = buildStoragePath('produto-123', 'foto.png')
    expect(path.endsWith('.png')).toBe(true)
  })
})
