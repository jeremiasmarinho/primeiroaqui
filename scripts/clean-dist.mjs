#!/usr/bin/env node
/**
 * Script de limpeza segura da pasta dist/assets.
 * Remove todos os artefatos .js/.css de builds anteriores antes de `vite
 * build` gerar os novos. Não tenta remover a pasta inteira (que pode ter
 * locks no Windows) — apaga arquivo por arquivo, best-effort.
 *
 * Por que apagar TUDO (e não "manter só o mais recente"): este script roda
 * no hook `prebuild`, ou seja, antes do `vite build` escrever qualquer coisa
 * nova. Logo, todo arquivo encontrado aqui é de um build anterior — inclusive
 * quando um build gera vários chunks .js de uma vez (code splitting via
 * React.lazy). A versão antiga desta lógica mantinha apenas 1 arquivo .js por
 * mtime, o que apagaria chunks legítimos e recém-gerados de um mesmo build
 * caso não fossem, por acaso, o mais recente — quebrando o code splitting.
 * Sem essa limpeza, dist/assets acumula bundles inteiros de builds antigos,
 * o que faz `check-bundle-size.mjs` (que soma todos os .js) reportar um
 * total inflado e incorreto.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const assetsDir = path.join(projectRoot, 'dist', 'assets')

const cleanOldAssets = () => {
  if (!fs.existsSync(assetsDir)) {
    console.log('dist/assets/ não existe, nada a limpar')
    return
  }

  try {
    const files = fs.readdirSync(assetsDir)
    const staleFiles = files.filter((file) => file.endsWith('.js') || file.endsWith('.css'))

    if (staleFiles.length === 0) {
      console.log('dist/assets/ já está limpa')
      return
    }

    let removed = 0
    for (const file of staleFiles) {
      const filePath = path.join(assetsDir, file)
      try {
        fs.unlinkSync(filePath)
        removed += 1
      } catch (err) {
        console.warn(`Aviso: não foi possível remover ${file} (${err.code ?? err.message})`)
      }
    }
    console.log(`Removidos ${removed}/${staleFiles.length} arquivo(s) de build anterior.`)
  } catch (err) {
    console.warn('Aviso: erro ao limpar arquivos antigos:', err.message)
  }
}

cleanOldAssets()
