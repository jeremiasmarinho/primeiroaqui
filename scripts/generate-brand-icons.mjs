// Gera os ícones de favicon/PWA a partir de public/brand/pin.png.
// Rodar com: node scripts/generate-brand-icons.mjs
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const pinPath = path.join(root, 'public', 'brand', 'pin.png')
const publicDir = path.join(root, 'public')

const BRAND_YELLOW = '#FFE600'

/** favicon-32.png: pin sobre fundo transparente. */
async function makeTransparent(size, outName) {
  const pin = await sharp(pinPath)
    .resize(Math.round(size * 0.82), Math.round(size * 0.82), { fit: 'contain' })
    .toBuffer()
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: pin, gravity: 'center' }])
    .png()
    .toFile(path.join(publicDir, outName))
  console.log(`gerado ${outName}`)
}

/** apple-touch-icon / pwa icons: pin sobre fundo amarelo com cantos arredondados. */
async function makeOnYellow(size, outName) {
  const radius = Math.round(size * 0.18)
  const roundedCornerMask = Buffer.from(
    `<svg width="${size}" height="${size}"><rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`,
  )

  const background = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BRAND_YELLOW,
    },
  })
    .png()
    .toBuffer()

  const pin = await sharp(pinPath)
    .resize(Math.round(size * 0.68), Math.round(size * 0.68), { fit: 'contain' })
    .toBuffer()

  const squareWithPin = await sharp(background)
    .composite([{ input: pin, gravity: 'center' }])
    .png()
    .toBuffer()

  await sharp(squareWithPin)
    .composite([{ input: roundedCornerMask, blend: 'dest-in' }])
    .png()
    .toFile(path.join(publicDir, outName))
  console.log(`gerado ${outName}`)
}

/**
 * Ícones maskable para PWA: fundo amarelo edge-to-edge (sem cantos
 * arredondados — quem arredonda é o SO) e o pin com ~20% de margem em
 * cada lado (pin ocupa ~60% do canvas) para caber na "safe zone" circular
 * que Android aplica ao recortar o ícone.
 */
async function makeMaskable(size, outName) {
  const background = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BRAND_YELLOW,
    },
  })
    .png()
    .toBuffer()

  const pin = await sharp(pinPath)
    .resize(Math.round(size * 0.6), Math.round(size * 0.6), { fit: 'contain' })
    .toBuffer()

  await sharp(background)
    .composite([{ input: pin, gravity: 'center' }])
    .png()
    .toFile(path.join(publicDir, outName))
  console.log(`gerado ${outName}`)
}

async function main() {
  await makeTransparent(32, 'favicon-32.png')
  await makeOnYellow(180, 'apple-touch-icon.png')
  await makeOnYellow(192, 'icon-192.png')
  await makeOnYellow(512, 'icon-512.png')
  await makeMaskable(192, 'icon-192-maskable.png')
  await makeMaskable(512, 'icon-512-maskable.png')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
