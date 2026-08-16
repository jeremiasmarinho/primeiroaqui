# Apps mobile — decisão e checklist pós-go-live

**Decisão (2026-08-16):** distribuição mobile via PWA (Android + iOS). Sem lojas e
sem APK por enquanto. O scaffold Capacitor Android (`android/`,
`capacitor.config.ts`) fica como caminho futuro; iOS nativo exigiria Mac + conta
Apple Developer (US$ 99/ano) e revisão hostil a WebView — não compensa neste estágio.

## O que já existe (nada a implementar)

- `public/manifest.webmanifest` — nome, ícones 192/512 any+maskable, standalone, pt-BR
- `public/apple-touch-icon.png` — ícone do "Adicionar à Tela de Início" no iOS
- `public/sw.js` registrado em prod via `src/main.tsx` — network-first p/ HTML e /api,
  cache-first p/ /assets, página offline

## Checklist de validação (rodar após go-live com HTTPS no domínio final)

- [ ] Lighthouse (Chrome DevTools → Lighthouse → PWA/instalabilidade) sem erros
- [ ] Android/Chrome: aparece o prompt "Instalar app"; instalar e abrir — sem barra de URL
- [ ] iOS/Safari: Compartilhar → Adicionar à Tela de Início — ícone correto, abre standalone
- [ ] Deploy novo reflete no app instalado após reabrir (network-first funcionando)
- [ ] Modo avião: página offline aparece (não tela branca)
- [ ] Ícone maskable sem cortes no launcher Android

## APK Android (gerado em 2026-08-16)

- APK assinado: `C:\Users\kllar\primeiroaqui\PrimeiroAqui.apk` (6,6 MB)
- Keystore: `C:\Users\kllar\Android\keystores\primeiroaqui.jks` (alias `primeiroaqui`,
  senha em `primeiroaqui-keystore-senha.txt` na mesma pasta — FAZER BACKUP; sem ela
  não há como publicar atualização com a mesma assinatura). NUNCA commitar.
- Modo WebView remoto: o app só mostra conteúdo após o go-live do domínio.
- Rebuild: `npm run build && npx cap sync android && (cd android && ./gradlew assembleRelease)`
  e assinar com zipalign + apksigner (build-tools 36) usando a keystore acima.
- SDK Android instalado em `C:\Users\kllar\Android\Sdk`.

## Caminho futuro (se/quando fizer sentido)

2. Play Store: US$ 25 único; trocar `server.url` por bundle local se a revisão exigir
   (já documentado em `capacitor.config.ts`)
3. App Store: só com Mac ou build na nuvem + US$ 99/ano
