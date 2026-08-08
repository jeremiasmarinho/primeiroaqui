# App Android (Capacitor) — guia de build

Status: scaffold pronto no repo (`capacitor.config.ts`, pasta `android/`,
ícones e splash gerados). **O build do APK nunca foi executado nesta
máquina** — não há Android SDK/JDK instalados aqui. Quem gera e valida o
APK é o usuário, em uma máquina com Android Studio.

## Como o app funciona

O app Android é uma casca WebView que carrega `https://primeiroaqui.koraforce.com.br`
diretamente (ver `server.url` em `capacitor.config.ts`, comentário lá
explica o trade-off). Ou seja: **não há bundle do site dentro do APK** —
todo deploy do site atualiza o app automaticamente, sem nova build.

Isso é ótimo para iteração, mas a Google Play tende a rejeitar ou pedir
justificativa para apps que são "só uma WebView apontando pra uma URL"
(pede mais conteúdo nativo / cache local / funcionamento offline mínimo).
Se isso virar bloqueio, o caminho é trocar para bundle local — ver seção
"Caminho para a Play Store" abaixo.

## Pré-requisitos (na máquina que for buildar)

1. [Android Studio](https://developer.android.com/studio) instalado (inclui o Android SDK).
2. JDK 17+ (o Android Studio já traz um embutido).
3. Node 20+ e este repo clonado, com `npm install` rodado.

## Passo a passo — gerar um APK de debug (para instalar no seu celular)

1. `npm run build` — gera `dist/` (mesmo que o site usa em produção; o
   WebView carrega a URL de produção, então este `dist/` só é usado se
   algum dia trocarmos para bundle local — mantenha-o atualizado mesmo
   assim, é copiado para `android/app/src/main/assets/public` por
   `npx cap copy android`).
2. `npx cap sync android` — sincroniza plugins nativos e config.
3. Abrir a pasta `android/` no Android Studio (`File > Open`).
4. Deixar o Gradle sincronizar (primeira vez demora, baixa dependências).
5. Conectar o celular via USB com "Depuração USB" ativada, ou usar um
   emulador (`Tools > Device Manager`).
6. `Run > Run 'app'` — instala e abre o app direto no aparelho/emulador.

### Gerar o `.apk` sem abrir a IDE (linha de comando, com SDK instalado)

```bash
cd android
./gradlew assembleDebug
# APK gerado em android/app/build/outputs/apk/debug/app-debug.apk
```

Copie esse `.apk` para o celular (ou `adb install app-debug.apk`) para
testar fora do Android Studio.

## Ícones e splash

Já gerados por `scripts/generate-android-assets.mjs` a partir de
`public/icon-512.png` e `public/brand/pin.png` — cobre `mipmap-*` (ícone
adaptativo, fundo amarelo `#FFE600` + pin como foreground) e `drawable*/splash.png`
(splash com o pin sobre amarelo). Rodar de novo se a marca mudar:

```bash
node scripts/generate-android-assets.mjs
```

Cor de status bar e navigation bar amarela (`#FFE600`) já configurada em
`android/app/src/main/res/values/styles.xml` (`android:statusBarColor` /
`android:navigationBarColor`).

## Caminho para a Play Store (futuro, não feito aqui)

1. **Trocar para bundle local**: em `capacitor.config.ts`, remover
   `server.url` e usar só `webDir: 'dist'`. O app passa a carregar o HTML
   do próprio APK. A API (`/api/...`) precisa então de uma URL absoluta
   configurável (ex.: variável injetada no build, nunca hardcoded) em vez
   de caminho relativo — hoje o front assume mesma origem
   (ver `src/server/root.ts`).
2. **Assinatura**: gerar um keystore de release (`keytool -genkeypair`),
   NUNCA versionar o `.jks`/`.keystore` (já coberto no `.gitignore`).
   Configurar `android/app/build.gradle` com `signingConfigs.release`.
3. **AAB em vez de APK**: a Play Store exige Android App Bundle.
   `./gradlew bundleRelease` gera o `.aab` em
   `android/app/build/outputs/bundle/release/`.
4. **Alternativa a considerar**: TWA (Trusted Web Activity) via
   [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) — mais
   simples que Capacitor quando o app é essencialmente o PWA (que já
   temos, ver Parte A deste projeto) sem necessidade de plugins nativos.
   Vale avaliar antes de investir em assinatura/release do Capacitor se
   nenhum plugin nativo (câmera, push, etc.) for necessário.
5. Preencher a ficha da Play Console (política de privacidade, screenshots,
   classificação de conteúdo) — processo manual, fora do escopo deste repo.

## O que NÃO foi validado nesta máquina

- Build Gradle (sem SDK/JDK instalados aqui).
- Instalação/execução do APK em device ou emulador real.
- Layout/comportamento do WebView em tela real (status bar, safe areas,
  splash) — o CSS de safe-area (`.safe-top`, `.safe-bottom` em
  `src/index.css`) já existe no site para a versão web/PWA e deve cobrir o
  WebView também, mas isso precisa ser confirmado visualmente pelo usuário.
