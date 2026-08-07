import sharp from 'sharp'
import { supabaseAdmin } from './supabaseClient'

const MAX_SIZE_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const STORE_LOGOS_BUCKET = 'store-logos'
const LOGO_SIZE = 256
const LOGO_JPEG_QUALITY = 82

export class StorageValidationError extends Error {}

/**
 * Valida tipo e tamanho de um logo de loja antes do upload — mesmos limites
 * de avatarStorage.ts.
 */
export const validateStoreLogo = (file: { size: number; type: string }): void => {
  if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
    throw new StorageValidationError(`Tipo de arquivo nao suportado: ${file.type}`)
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new StorageValidationError(`Arquivo excede o limite de ${MAX_SIZE_BYTES / 1024 / 1024}MB`)
  }
}

/**
 * Deriva o path de storage para o logo de uma loja: `<storeId>/<uuid>.jpg`.
 * Sempre `.jpg` — a imagem e reprocessada em `processStoreLogoImage`,
 * independente do formato original enviado.
 */
export const buildStoreLogoStoragePath = (storeId: string): string => `${storeId}/${crypto.randomUUID()}.jpg`

/**
 * Processa a imagem enviada: recorte quadrado centralizado, redimensionado
 * para 256px, reencodado como JPEG qualidade 82. Mesmo tratamento de
 * avatarStorage.ts.
 */
export const processStoreLogoImage = async (buffer: Buffer): Promise<Buffer> => {
  try {
    return await sharp(buffer)
      .resize({
        width: LOGO_SIZE,
        height: LOGO_SIZE,
        fit: 'cover',
        position: 'centre',
      })
      .jpeg({ quality: LOGO_JPEG_QUALITY })
      .toBuffer()
  } catch {
    throw new StorageValidationError('Arquivo nao e uma imagem valida')
  }
}

let bucketEnsured: Promise<void> | undefined

/**
 * Garante que o bucket `store-logos` existe no Supabase Storage (idempotente).
 * Mesmo padrao de `ensureAvatarsBucket` — memoizado por processo, chamado de
 * forma lazy na primeira requisicao de upload.
 */
export const ensureStoreLogosBucket = async (): Promise<void> => {
  if (!bucketEnsured) {
    bucketEnsured = (async () => {
      const { data: existing } = await supabaseAdmin.storage.getBucket(STORE_LOGOS_BUCKET)
      if (existing) return

      const { error } = await supabaseAdmin.storage.createBucket(STORE_LOGOS_BUCKET, {
        public: true,
        fileSizeLimit: '5MB',
        allowedMimeTypes: [...ALLOWED_TYPES],
      })
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
