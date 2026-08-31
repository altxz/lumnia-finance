# Entrega Android e validação

## Regra de entrega

Uma mudança web não está no Android até que o APK instalado contenha o bundle atualizado e o fluxo alterado seja exercitado no Galaxy S22 Ultra. Build concluído não é evidência suficiente.

## Pré-requisito de ambiente (Windows, nesta máquina)

Antes de qualquer comando `gradlew`, defina:

```powershell
$env:JAVA_TOOL_OPTIONS = "-Djdk.net.unixdomain.tmpdir=C:\gradletemp"
```

Sem isso, `gradlew` falha com `java.io.IOException: Unable to establish loopback connection` em qualquer tarefa (mesmo `:app:clean`), independente da versão do JDK (21 ou 17 apresentam o mesmo erro). A causa é a criação de um socket de domínio Unix interno do JDK no Windows; `C:\gradletemp` só precisa ser uma pasta sem caracteres acentuados. Ver detalhe em `02-falhas-e-correcoes.md`.

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
- Consolidação de 30/08/2026 (commits `7328588`, `958dc38`, `a2c9ccb`, `07f50a0`): APK debug SHA-256 `EF89042613E6C77065AE1F3E671BF79E059B8D73F8BF15AA369F82A4283D4BD` gerado às 17:54, instalado com `adb install -r` (dados preservados) e aberto às 17:56 sem exceção fatal no `logcat`. Screenshot do aparelho confirma a barra inferior sem o botão de IA (Resumo, Atividade, +, Planejar) e o dashboard carregando dados reais. Inclui: fluxo de pagamento de fatura unificado, evolução patrimonial por snapshots, remoção do chat de IA e da sugestão automática de categoria, correção de segurança do `chat-genius`. O usuário confirmou separadamente, por teste físico próprio, que o pagamento de fatura com data diferente do vencimento (nos dois caminhos) e uma importação completa também estão validados e funcionando.
- Consolidação de 30/08/2026, à noite (commits até `afe55db` — Etapa 7 completa, Etapa 8 completa, limpeza de código morto em Categorias, correção do cron de recorrência): APK debug SHA-256 `37FA0A97C5DA6D2DFADA3DB240DA5A3147F7F1F742C269058764EBE43152A886` gerado às 20:52, instalado com `adb install -r` (dados preservados) e aberto às 20:53 sem exceção fatal no `logcat`. Validado fisicamente no Galaxy S22 Ultra: Dashboard com carregamento escalonado por seção sem falha visual; modal "Nova despesa" abrindo como bottom sheet nativo (alça de arraste, cantos arredondados) ao tocar no botão flutuante; barra inferior com 4 colunas (Resumo, Atividade, +, Planejar); página de Categorias mostrando o link "Configurações → Categorias" corretamente em largura de celular. Com isso, a Etapa 8 do roadmap está oficialmente concluída (código + validação física).
- Consolidação de 30/08/2026, madrugada (commits até `2487170` — projeção visual de recorrência de cartão ligada a `matchExpensesToInvoice`, exclusão segura por fatura): APK debug SHA-256 `A045497643F5E2BBBEDB105A3B79207983D4F2948BE11070CF9CD5D5DADE45B4` gerado às 21:42, instalado com `adb install -r` e aberto às 21:43 sem exceção fatal no `logcat`. Validado fisicamente no Galaxy S22 Ultra: fatura de novembro do Nubank Crédito mostrando corretamente as recorrências projetadas "Claude" (30/set.) e "Onedrive" (30/set.) junto com "Game Pass" (já materializado pelo cron, 01/out.) — mesmo resultado já confirmado no navegador com os mesmos dados reais.
- Consolidação de 31/08/2026, madrugada (commits até `7aa17a7` — correção do fluxo "editar recorrência de cartão > todas as recorrências", feita numa sessão paralela e revisada linha a linha antes de aplicar): APK debug SHA-256 `98F1666F7358DB610C8E5E382B5211F59BD152C07E8B07CBC63F373DC1357BBB` gerado às 01:18, instalado com `adb install -r` e aberto às 01:19 sem exceção fatal no `logcat`, dashboard renderizando normalmente em dark mode. Não foi testado ao vivo o fluxo específico de editar e escolher "todas as recorrências" no aparelho (mutaria a assinatura real "Claude"); validação desse trecho ficou por revisão de código + 18 testes automatizados em `recurringCardProjection.test.ts`.
