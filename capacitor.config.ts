import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Scaffold do app Android (WebView) via Capacitor.
 *
 * Modo escolhido: WebView REMOTO (server.url aponta para produção), não
 * bundle local do dist/. Trade-off consciente:
 * - A favor: qualquer deploy do site atualiza o app instantaneamente, sem
 *   passar por nova build/assinatura/instalação do APK. Zero duplicação de
 *   lógica entre "site" e "app".
 * - Contra: a Play Store prefere apps com conteúdo local (não só uma
 *   casca de WebView apontando pra uma URL) — pode gerar fricção na
 *   revisão, e o app não funciona 100% offline.
 * - Caminho futuro se a Play Store exigir: trocar `server.url` por
 *   `webDir: 'dist'` (bundlear o build local dentro do APK) e apontar a
 *   API via variável de ambiente injetada no build (nunca hardcoded), com
 *   `npx cap copy` a cada release. Fica documentado aqui para não se
 *   perder a decisão.
 */
const config: CapacitorConfig = {
  appId: 'br.com.koraforce.primeiroaqui',
  appName: 'Primeiro Aqui',
  webDir: 'dist',
  server: {
    url: 'https://primeiroaqui.koraforce.com.br',
    cleartext: false,
  },
}

export default config
