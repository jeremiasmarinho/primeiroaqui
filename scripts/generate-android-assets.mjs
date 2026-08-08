// Gera ícones (mipmap) e splash screen do app Android a partir de
// public/icon-512.png e public/brand/pin.png.
//
// Não requer Android SDK — só grava PNGs nas pastas de recursos que
// `npx cap add android` já criou. Rodar com:
//   node scripts/generate-android-assets.mjs
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const icon512Path = path.join(root, 'public', 'icon-512.png')
const pinPath = path.join(root, 'public', 'brand', 'pin.png')
const resDir = path.join(root, 'android', 'app', 'src', 'main', 'res')

const BRAND_YELLOW = '#FFE600'

// Densidades padrão do Android e o tamanho do launcher icon em cada uma.
const DENSITIES = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
}

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true })
}

async function generateLauncherIcons() {
  for (const [density, size] of Object.entries(DENSITIES)) {
    const dir = path.join(resDir, `mipmap-${density}`)
    await ensureDir(dir)
    const buf = await sharp(icon512Path).resize(size, size).png().toBuffer()
    await sharp(buf).toFile(path.join(dir, 'ic_launcher.png'))
    await sharp(buf).toFile(path.join(dir, 'ic_launcher_round.png'))

    // Foreground para adaptive icon (ícone menor, com respiro, sobre fundo
    // sólido amarelo definido em mipmap-anydpi-v26/ic_launcher.xml).
    const foregroundSize = Math.round(size * 1.5) // adaptive icons usam canvas 108dp p/ 72dp de conteúdo
    const pin = await sharp(pinPath)
      .resize(Math.round(foregroundSize * 0.55), Math.round(foregroundSize * 0.55), {
        fit: 'contain',
      })
      .toBuffer()
    await sharp({
      create: {
        width: foregroundSize,
        height: foregroundSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: pin, gravity: 'center' }])
      .png()
      .toFile(path.join(dir, 'ic_launcher_foreground.png'))

    console.log(`gerado mipmap-${density}/ic_launcher*.png`)
  }
}

async function generateAdaptiveIconXml() {
  const dir = path.join(resDir, 'mipmap-anydpi-v26')
  await ensureDir(dir)
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
`
  await fs.promises.writeFile(path.join(dir, 'ic_launcher.xml'), xml)
  await fs.promises.writeFile(path.join(dir, 'ic_launcher_round.xml'), xml)

  const valuesDir = path.join(resDir, 'values')
  await ensureDir(valuesDir)
  const colorsPath = path.join(valuesDir, 'ic_launcher_background.xml')
  await fs.promises.writeFile(
    colorsPath,
    `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${BRAND_YELLOW}</color>
</resources>
`,
  )
  console.log('gerado mipmap-anydpi-v26/ic_launcher*.xml + ic_launcher_background.xml')
}

// Splash screen: pin centralizado sobre fundo amarelo, um tamanho único
// (drawable/) é suficiente — o Capacitor centraliza e recorta conforme a tela.
async function generateSplash() {
  const size = 1200
  const background = await sharp({
    create: { width: size, height: size, channels: 4, background: BRAND_YELLOW },
  })
    .png()
    .toBuffer()
  const pin = await sharp(pinPath)
    .resize(Math.round(size * 0.35), Math.round(size * 0.35), { fit: 'contain' })
    .toBuffer()
  const splash = await sharp(background).composite([{ input: pin, gravity: 'center' }]).png().toBuffer()

  const drawableDirs = fs
    .readdirSync(resDir)
    .filter((name) => name === 'drawable' || name.startsWith('drawable-'))
  for (const dirName of drawableDirs) {
    const dir = path.join(resDir, dirName)
    const target = path.join(dir, 'splash.png')
    if (fs.existsSync(target)) {
      await sharp(splash).toFile(target)
      console.log(`gerado ${dirName}/splash.png`)
    }
  }
}

async function main() {
  if (!fs.existsSync(resDir)) {
    console.error(
      `Pasta ${resDir} não existe. Rode "npx cap add android" antes deste script.`,
    )
    process.exit(1)
  }
  await generateLauncherIcons()
  await generateAdaptiveIconXml()
  await generateSplash()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
