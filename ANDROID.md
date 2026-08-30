# Lumnia para Android

O projeto Android é gerado com Capacitor e fica no diretório `android/`.

## Requisitos locais

- Node.js 22 ou superior
- pnpm 11.19.0
- Android Studio com Android SDK 36
- JDK 21

## Preparar os arquivos Android

```sh
pnpm install --frozen-lockfile
pnpm android:prepare
```

O comando compila o React em `dist/` e sincroniza os arquivos e plugins com o
projeto Android.

## Abrir e executar

```sh
pnpm android:open
```

No Android Studio, aguarde a sincronização do Gradle e execute o app em um
emulador ou aparelho Android.

## Configuração atual

- Application ID: `com.lumnia.finance`
- Nome: `Lumnia`
- Minimum SDK: 24 (Android 7.0)
- Compile SDK: 36
- Target SDK: 36
- Arquivos web empacotados: `dist/`

## Antes da publicação

- Validar login por e-mail e senha em um aparelho real.
- Adaptar o login Google para deep link nativo. O redirecionamento web atual usa
  `window.location.origin` e não deve ser considerado pronto para produção no
  WebView do Capacitor.
- Implementar notificações nativas com Firebase Cloud Messaging. O Web Push por
  service worker existente atende a versão web, não substitui a integração
  Android nativa.
- Configurar a chave de upload e gerar um Android App Bundle assinado no Android
  Studio.
- Substituir os arquivos web empacotados sempre que o frontend mudar executando
  `pnpm android:prepare`.
- Antes de distribuir um APK, validar o bundle copiado em
  `android/app/src/main/assets/public`, reconstruir o APK sem cache, instalar no
  aparelho real e testar o fluxo alterado.
