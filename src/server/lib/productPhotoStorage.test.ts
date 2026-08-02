import {
  validateProductPhoto,
  buildStoragePath,
  buildThumbStoragePath,
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
    const path = buildStoragePath('produto-123', 'image/jpeg')
    expect(path).toMatch(
      /^produto-123\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/,
    )
  })

  it('deriva extensao .jpg para image/jpeg', () => {
    const path = buildStoragePath('produto-123', 'image/jpeg')
    expect(path.endsWith('.jpg')).toBe(true)
  })

  it('deriva extensao .png para image/png', () => {
    const path = buildStoragePath('produto-123', 'image/png')
    expect(path.endsWith('.png')).toBe(true)
  })

  it('deriva extensao .webp para image/webp', () => {
    const path = buildStoragePath('produto-123', 'image/webp')
    expect(path.endsWith('.webp')).toBe(true)
  })

  it('rejeita MIME type nao suportado, mesmo com nome de arquivo com extensao valida', () => {
    expect(() => buildStoragePath('produto-123', 'application/pdf')).toThrow(
      StorageValidationError,
    )
  })
})

describe('buildThumbStoragePath', () => {
  it('insere sufixo -thumb antes da extensao', () => {
    expect(buildThumbStoragePath('produto-123/abc.jpg')).toBe('produto-123/abc-thumb.jpg')
    expect(buildThumbStoragePath('produto-123/abc.webp')).toBe('produto-123/abc-thumb.webp')
  })

  it('rejeita path sem extensao', () => {
    expect(() => buildThumbStoragePath('produto-123/abc')).toThrow(StorageValidationError)
  })
})
