import { supabaseAdmin } from './supabaseClient'

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

const EXTENSION_BY_MIME_TYPE: Record<(typeof ALLOWED_TYPES)[number], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

/**
 * Deriva a extensao do MIME type ja validado (nunca do nome do arquivo enviado
 * pelo cliente) — evita gravar no storage uma extensao arbitraria controlada
 * externamente.
 */
export const buildStoragePath = (productId: string, type: string): string => {
  const ext = EXTENSION_BY_MIME_TYPE[type as (typeof ALLOWED_TYPES)[number]]
  if (!ext) {
    throw new StorageValidationError(`Tipo de arquivo nao suportado: ${type}`)
  }
  return `${productId}/${crypto.randomUUID()}.${ext}`
}

/**
 * Deriva o path do thumbnail a partir do path do original (mesmo diretorio,
 * sufixo `-thumb` antes da extensao). Mantido junto do original para que
 * ambos sejam removidos com um unico `remove([path, thumbPath])`.
 */
export const buildThumbStoragePath = (originalPath: string): string => {
  const lastDot = originalPath.lastIndexOf('.')
  if (lastDot === -1) {
    throw new StorageValidationError(`Path de storage invalido: ${originalPath}`)
  }
  return `${originalPath.slice(0, lastDot)}-thumb${originalPath.slice(lastDot)}`
}

let bucketEnsured: Promise<void> | undefined

/**
 * Garante que o bucket `product-photos` existe no Supabase Storage (idempotente).
 * Memoizado por processo — chamado de forma lazy na primeira requisicao de
 * upload (mais simples de testar do que acoplar ao bootstrap do servidor, e
 * evita custo de rede em processos que nunca fazem upload, ex.: rodar so os
 * testes de outra rota).
 */
export const ensureProductPhotosBucket = async (): Promise<void> => {
  if (!bucketEnsured) {
    bucketEnsured = (async () => {
      const { data: existing } = await supabaseAdmin.storage.getBucket(PRODUCT_PHOTOS_BUCKET)
      if (existing) return

      const { error } = await supabaseAdmin.storage.createBucket(PRODUCT_PHOTOS_BUCKET, {
        public: true,
        fileSizeLimit: '5MB',
        allowedMimeTypes: [...ALLOWED_TYPES],
      })
      // Corrida entre processos/testes concorrentes: se outro processo criou
      // o bucket entre o getBucket e o createBucket acima, ignore o erro de
      // "ja existe" (idempotencia real, nao so por processo).
      if (error && !/already exists/i.test(error.message)) {
        throw error
      }
    })().catch((error: unknown) => {
      bucketEnsured = undefined
      throw error
    })
  }
  return bucketEnsured
}
