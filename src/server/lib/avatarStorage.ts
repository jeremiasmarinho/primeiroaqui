import sharp from 'sharp'
import { supabaseAdmin } from './supabaseClient'

const MAX_SIZE_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const AVATARS_BUCKET = 'avatars'
const AVATAR_SIZE = 256
const AVATAR_JPEG_QUALITY = 82

export class StorageValidationError extends Error {}

/**
 * Valida tipo e tamanho de uma foto de perfil antes do upload — mesmos
 * limites do upload de foto de produto (ver productPhotoStorage.ts).
 */
export const validateAvatarPhoto = (file: { size: number; type: string }): void => {
  if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
    throw new StorageValidationError(`Tipo de arquivo nao suportado: ${file.type}`)
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new StorageValidationError(`Arquivo excede o limite de ${MAX_SIZE_BYTES / 1024 / 1024}MB`)
  }
}

/**
 * Deriva o path de storage para o avatar de um usuario: `<userId>/<uuid>.jpg`.
 * Sempre `.jpg` — a imagem e reprocessada para JPEG em `processAvatarImage`,
 * independente do formato original enviado.
 */
export const buildAvatarStoragePath = (userId: string): string => `${userId}/${crypto.randomUUID()}.jpg`

/**
 * Processa a imagem enviada: recorte quadrado centralizado, redimensionado
 * para 256px, reencodado como JPEG qualidade 82. Sem thumbnail separado —
 * diferente de fotos de produto, o avatar ja e pequeno o suficiente para
 * servir os dois usos (lista e detalhe).
 */
export const processAvatarImage = async (buffer: Buffer): Promise<Buffer> => {
  try {
    return await sharp(buffer)
      .resize({
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        fit: 'cover',
        position: 'centre',
      })
      .jpeg({ quality: AVATAR_JPEG_QUALITY })
      .toBuffer()
  } catch {
    throw new StorageValidationError('Arquivo nao e uma imagem valida')
  }
}

let bucketEnsured: Promise<void> | undefined

/**
 * Garante que o bucket `avatars` existe no Supabase Storage (idempotente).
 * Mesmo padrao de `ensureProductPhotosBucket` — memoizado por processo,
 * chamado de forma lazy na primeira requisicao de upload.
 */
export const ensureAvatarsBucket = async (): Promise<void> => {
  if (!bucketEnsured) {
    bucketEnsured = (async () => {
      const { data: existing } = await supabaseAdmin.storage.getBucket(AVATARS_BUCKET)
      if (existing) return

      const { error } = await supabaseAdmin.storage.createBucket(AVATARS_BUCKET, {
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
