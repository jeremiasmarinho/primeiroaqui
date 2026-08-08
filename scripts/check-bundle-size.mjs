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

// DECISÃO HUMANA REGISTRADA (2026-08-07, aprovada pelo dono do projeto via
// AskUserQuestion): a métrica principal passa a ser o bundle INICIAL (chunks
// baixados para abrir o app: entry + CSS não contam, só .js sem lazy), limite
// de 330 kB — o mesmo teto de 01/08, agora medindo o que o usuário paga na
// primeira visita. Telas carregadas via React.lazy pagam o próprio peso sob
// demanda e são cobertas por um teto de segurança TOTAL de 450 kB contra
// crescimento descontrolado. Racional: entre 01 e 07/08 o app dobrou de
// escopo (OAuth, toasts, dashboards, CRM) e a soma cega punia code-splitting.
// Baixar limites é permitido; SUBIR qualquer um exige nova decisão humana.
const MAX_INITIAL_KB = 330
const MAX_TOTAL_KB = 450
const MAX_INITIAL_BYTES = MAX_INITIAL_KB * 1024
const MAX_TOTAL_BYTES = MAX_TOTAL_KB * 1024

// Chunks lazy conhecidos (nome do arquivo gerado pelo Vite = nome da tela).
// Qualquer chunk cujo nome NÃO case aqui conta como inicial — o padrão seguro:
// um chunk novo desconhecido pesa no orçamento apertado até ser classificado.
const LAZY_CHUNK_PATTERN =
  /^(AdminScreen|StoreDashboardScreen|ResetPasswordScreen|OAuthCallbackScreen|CategoriesScreen|FavoritesScreen|AddressesScreen|OrdersScreen|ProfileScreen)-/

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

  let totalBytes = 0
  let initialBytes = 0
  const fileSizes = []

  for (const file of jsFiles) {
    const filePath = path.join(assetsDir, file)
    const stat = fs.statSync(filePath)
    const lazy = LAZY_CHUNK_PATTERN.test(file)
    totalBytes += stat.size
    if (!lazy) initialBytes += stat.size
    fileSizes.push({ name: file, size: stat.size, lazy })
  }

  fileSizes.sort((a, b) => b.size - a.size)

  const fmt = (bytes) => (bytes / 1024).toFixed(2)

  console.log('\n--- Bundle Size Report ---')
  console.log(`Chunks encontrados: ${fileSizes.length}`)
  console.log('\nArquivos (maior -> menor):')

  for (const { name, size, lazy } of fileSizes) {
    console.log(`  ${name}: ${fmt(size)} KB${lazy ? ' (lazy)' : ''}`)
  }

  console.log(`\nBundle inicial: ${fmt(initialBytes)} KB (limite: ${MAX_INITIAL_KB} KB)`)
  console.log(`Total (inicial + lazy): ${fmt(totalBytes)} KB (teto de segurança: ${MAX_TOTAL_KB} KB)`)

  if (initialBytes > MAX_INITIAL_BYTES) {
    console.error(`\n❌ FALHOU: bundle inicial (${fmt(initialBytes)} KB) excede o limite (${MAX_INITIAL_KB} KB).`)
    console.error(`Redução necessária: ${fmt(initialBytes - MAX_INITIAL_BYTES)} KB.`)
    process.exit(1)
  }
  if (totalBytes > MAX_TOTAL_BYTES) {
    console.error(`\n❌ FALHOU: JavaScript total (${fmt(totalBytes)} KB) excede o teto de segurança (${MAX_TOTAL_KB} KB).`)
    process.exit(1)
  }

  console.log(`\n✓ OK: JavaScript dentro do orçamento.`)
  process.exit(0)
}

main()
