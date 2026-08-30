# Entrega Android e validação

## Regra de entrega

Uma mudança web não está no Android até que o APK instalado contenha o bundle atualizado e o fluxo alterado seja exercitado no Galaxy S22 Ultra. Build concluído não é evidência suficiente.

## Sequência obrigatória

1. Confirmar a branch `codex/android-capacitor`.
2. Restaurar dependências, se necessário:

```sh
pnpm install --frozen-lockfile
```

3. Executar validações proporcionais ao risco:

```sh
pnpm typecheck
pnpm test
pnpm build
```

4. Sincronizar o projeto Capacitor:

```sh
pnpm android:sync
```

5. Procurar no bundle copiado em `android/app/src/main/assets/public/assets/` uma assinatura textual da mudança. A assinatura precisa corresponder ao arquivo gerado atual.
6. Reconstruir o APK sem reutilizar cache de aplicação:

```sh
cd android
gradlew.bat --no-daemon :app:clean :app:assembleDebug
```

7. Abrir o APK como ZIP e confirmar que o bundle atualizado existe dentro de `assets/public/assets/`.
8. Registrar hash SHA-256, tamanho e horário do APK.
9. Instalar preservando dados:

```sh
D:\Android\Sdk\platform-tools\adb.exe install -r android\app\build\outputs\apk\debug\app-debug.apk
```

10. Abrir o aplicativo, consultar logcat por exceções fatais e executar o fluxo modificado no aparelho.
11. Atualizar o roadmap com evidência real e pendência residual, se houver.

## Pontos de falha conhecidos

### APK antigo apesar de build novo

Sintoma: o código e o Vite parecem corretos, mas o celular exibe a versão anterior.

Causa provável: APK de Gradle reaproveitado sem incorporar os assets sincronizados.

Resposta: executar limpeza do módulo Android, confirmar o arquivo JavaScript dentro do APK e só então instalar.

### Importador e ActivityResult

Sintoma: selecionar arquivo fecha a tela ou retorna à aba inicial.

Causa provável: retorno da Activity do seletor não chegou à ponte do Capacitor, a WebView foi recriada ou o APK está antigo.

Resposta: capturar logcat durante a ação, confirmar callback no plugin nativo e testar arquivo descartável. Não culpar o arquivo do usuário sem evidência.

### Teclado e modais

Sintoma: modal reduz, corta rodapé ou sobrepõe conteúdo quando o teclado fecha.

Resposta: evitar depender apenas de unidades de viewport dinâmicas; testar abrir campo, digitar, recolher teclado, rolar e confirmar ação.

## Matriz mínima por tela alterada

| Dimensão | Verificação |
|---|---|
| Tema | Light e dark |
| Dados | Carregado, loading, vazio, erro e offline quando aplicável |
| Conteúdo | Texto longo, valor grande, nome de categoria e descrição longos |
| Layout | Galaxy S22 Ultra, 360 px e desktop |
| Interação | Toque, scroll, teclado, modal, retorno e navegação |
| Financeiro | Valor, data, conta, cartão, fatura e efeito no saldo quando houver |

## Evidências recentes

- Etapa 5: APK SHA-256 `9A85C354064E9CF7CD71662974CD5A5B1CC42940D63BDBBE8F70CBF83CCF1B72` instalado e aberto no Galaxy em 30/08/2026 às 14:00 sem exceção fatal; validação visual confirmada pelo usuário.
- Correção de fatura: APK SHA-256 `0405CEE37462B642793C0A6A294CD77698C12AEE870694F96DC90927ACB77630` instalado e aberto às 11:33 do mesmo dia; ainda há cenário de pagamento com data distinta do vencimento indicado no roadmap.
