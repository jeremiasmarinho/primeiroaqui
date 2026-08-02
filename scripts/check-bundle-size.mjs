#!/usr/bin/env node
/**
 * Verifica se o tamanho total de JavaScript em dist/assets não excede 330 kB.
 *
 * Executar após `npm run build`. Falha com código 1 se o limite for excedido.
 * CSS e outros assets não são contabilizados — apenas .js.
 *
 * IMPORTANTE: com code splitting (React.lazy), um build gera vários chunks
 * .js (entry + chunks sob demanda). Todos eles são baixados por *algum*
 * usuário eventualmente, então o orçamento soma TODOS os .js de dist/assets
 * — não apenas o mais recente por mtime. Checar só "o mais recente" dava
 * verde falso: um chunk pequeno e novo escondia chunks grandes já existentes.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const assetsDir = path.join(projectRoot, 'dist', 'assets')

// Gate: NODE_ENV nunca deve ser definido em .env.local/.env.example. O Vite
// carrega essas variaveis e, se NODE_ENV estiver setado, sobrescreve o modo
// real do comando — inclusive em `vite build` (producao) — forcando um bundle
// de react-dom em modo desenvolvimento e quase dobrando o tamanho, sem erro
// visivel. Ja aconteceu neste projeto (ver docs/runbook.md, seção
// "`.env.local` nunca deve definir `NODE_ENV`"). Documentação sozinha não
// impede que alguém reintroduza a linha; este gate falha o build antes que
// isso passe despercebido.
const ENV_FILES_TO_CHECK = ['.env.local', '.env.example']
const NODE_ENV_LINE_PATTERN = /^\s*NODE_ENV\s*=\s*(.*)\s*$/

const checkNodeEnvNotSet = () => {
  for (const fileName of ENV_FILES_TO_CHECK) {
    const filePath = path.join(projectRoot, fileName)
    if (!fs.existsSync(filePath)) continue

    const lines = fs.readFileSync(filePath, 'utf-8').split('\n')
    for (const line of lines) {
      const match = line.match(NODE_ENV_LINE_PATTERN)
      if (match && match[1].trim() !== '') {
        console.error(`\n❌ FALHOU: ${fileName} define NODE_ENV=${match[1].trim()}.`)
        console.error(
          'O Vite carrega essa variável e sobrescreve o modo real do comando — ' +
            'inclusive em `vite build` (produção) — gerando um bundle de ' +
            'react-dom em modo desenvolvimento e quebrando o orçamento de bundle ' +
            'silenciosamente. Remova a linha NODE_ENV= deste arquivo. ' +
            'Ver docs/runbook.md, seção "`.env.local` nunca deve definir `NODE_ENV`".',
        )
        process.exit(1)
      }
    }
  }
}

checkNodeEnvNotSet()

// 330 kB — decisão registrada em ORQUESTRACAO-MVP-FASE2.md §10 (2026-08-01):
// React+ReactDOM custam ~190 kB minificados; o app inteiro (12 telas, rotas,
// estado) usa ~122 kB. Cortar abaixo disso exigiria trocar de framework —
// fora do escopo do MVP. Baixar este limite sem justificativa é permitido;
// SUBIR sem decisão humana registrada é violação do gate.
const MAX_SIZE_KB = 330
const MAX_SIZE_BYTES = MAX_SIZE_KB * 1024

const main = () => {
  if (!fs.existsSync(assetsDir)) {
    console.error(`Erro: diretório ${assetsDir} não encontrado.`)
    console.error('Execute "npm run build" antes de verificar o tamanho do bundle.')
    process.exit(1)
  }

  const files = fs.readdirSync(assetsDir)
  const jsFiles = files.filter((file) => file.endsWith('.js'))

  if (jsFiles.length === 0) {
    console.error('Erro: nenhum arquivo .js encontrado em dist/assets.')
    process.exit(1)
  }

  // Soma TODOS os .js em dist/assets — entry chunk + chunks de code splitting
  // (ex.: telas carregadas via React.lazy). Nenhum chunk fica de fora só por
  // não ser o mais recente.
  let totalBytes = 0
  const fileSizes = []

  for (const file of jsFiles) {
    const filePath = path.join(assetsDir, file)
    const stat = fs.statSync(filePath)
    totalBytes += stat.size
    fileSizes.push({ name: file, size: stat.size })
  }

  fileSizes.sort((a, b) => b.size - a.size)

  const totalKB = (totalBytes / 1024).toFixed(2)
  const maxKB = (MAX_SIZE_BYTES / 1024).toFixed(2)

  console.log('\n--- Bundle Size Report ---')
  console.log(`Chunks encontrados: ${fileSizes.length}`)
  console.log('\nArquivos (maior -> menor):')

  for (const { name, size } of fileSizes) {
    const kb = (size / 1024).toFixed(2)
    console.log(`  ${name}: ${kb} KB`)
  }

  console.log(`\nTotal JavaScript (soma de todos os chunks): ${totalKB} KB (limite: ${maxKB} KB)`)

  if (totalBytes > MAX_SIZE_BYTES) {
    console.error(`\n❌ FALHOU: JavaScript total (${totalKB} KB) excede o limite (${maxKB} KB).`)
    console.error(
      `Redução necessária: ${((totalBytes - MAX_SIZE_BYTES) / 1024).toFixed(2)} KB.`,
    )
    process.exit(1)
  }

  console.log(`\n✓ OK: JavaScript dentro do orçamento.`)
  process.exit(0)
}

main()
