const MAX_SIZE_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const PRODUCT_PHOTOS_BUCKET = 'product-photos'

export class StorageValidationError extends Error {}

export type UploadedPhoto = {
  url: string
  thumbUrl: string
  path: string
}

/**
 * Valida tipo e tamanho de uma foto de produto antes do upload.
 * Escopo desta fase: so validacao e geracao de path (testavel sem rede).
 * Upload real e thumbnail ficam para a Fase 5 (rota POST /products/:id/photos).
 */
export const validateProductPhoto = (file: { size: number; type: string }): void => {
  if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
    throw new StorageValidationError(`Tipo de arquivo nao suportado: ${file.type}`)
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new StorageValidationError(`Arquivo excede o limite de ${MAX_SIZE_BYTES / 1024 / 1024}MB`)
  }
}

export const buildStoragePath = (productId: string, fileName: string): string => {
  const ext = fileName.split('.').pop() ?? 'jpg'
  return `${productId}/${crypto.randomUUID()}.${ext}`
}
