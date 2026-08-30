# Contexto e estado atual

Atualizado em 30/08/2026.

## Repositório e ambiente

- Repositório oficial: `C:\Users\Álvarp\OneDrive\Documentos\Lumnia`.
- Branch de trabalho: `codex/android-capacitor`.
- A branch `main` não deve ser alterada durante o redesign.
- Aplicação: React, TypeScript, Vite, Tailwind, Supabase e Capacitor Android.
- Gerenciador oficial: `pnpm@11.19.0`; o lockfile único é `pnpm-lock.yaml`.
- Pacote Android: `com.lumnia.finance`.
- Dispositivo de validação: Galaxy S22 Ultra.

## Estrutura relevante

```text
android/     projeto nativo versionado
design/      fontes de identidade, marca e publicação
docs/        roadmap, auditorias, evidências e esta memória
public/      recursos consumidos pelo web/PWA
scripts/     scripts de manutenção e build do MCP
src/         aplicação React
supabase/    funções e migrações
```

`node_modules/`, `dist/`, `android/.gradle/` e `android/app/build/` são artefatos locais regeneráveis. Após a limpeza de 30/08/2026, reinstalar dependências com `pnpm install --frozen-lockfile` antes de compilar.

## Estado do redesign

| Etapa | Estado confirmado |
|---|---|
| 0. Inventário | Concluída |
| 1. Sistema visual | Concluída |
| 2. Dashboard vertical | Concluída e aprovada |
| 3. Transações | Concluída; correção de manutenção de fatura ainda exige a validação indicada no roadmap |
| 4. Planejamento | Concluída e validada |
| 5. Patrimônio | Concluída e validada pelo usuário em 30/08/2026 |
| 6. Analytics | Implementada, pendente de validação física final |
| 7. Configurações | Diagnóstico e correções parciais; importação Android segue pendente de teste seguro completo |
| 8. Movimento e estados | Pendente |
| 9. Auditoria final | Pendente |

## Decisões de produto aprovadas

- Direção visual: `Lumnia Calm Intelligence`, aprovada em 24/08/2026.
- Referência: princípios de clareza e calma da Apple, sem copiar componentes do iOS.
- Fonte principal: Inter.
- Vidro apenas em navegação, menus, popovers e modais. Conteúdo financeiro usa superfícies sólidas ou tonais.
- Não usar reticências para esconder textos ou valores relevantes. Em telas estreitas, o conteúdo deve quebrar, empilhar ou usar layout alternativo.
- Orçamento é por categoria, independente da receita mensal. A atenção ocorre ao aproximar ou ultrapassar o limite.
- Planejamento é uma única entrada por categoria; o card abre o detalhe da categoria, sem expansão interna.

## Pendências que não podem ser omitidas

1. Validar visualmente a correção de fatura paga em data diferente do vencimento, nos dois caminhos de pagamento.
2. Validar importação completa no Android em base descartável ou cópia de segurança.
3. Reconectar (novo login OAuth) o cliente MCP no ChatGPT — o servidor já está correto, confirmado em 30/08/2026.
4. Concluir validação física de Analytics e revisar Etapas 7 a 9.
5. Decidir e configurar o provedor de IA que substituirá `LOVABLE_API_KEY` (ausente no projeto Supabase independente atual); sem isso, `categorize-expense` e `chat-genius` continuam indisponíveis. `chat-genius` já foi corrigida (falha de autenticação) e publicada via CLI local em 30/08/2026.
6. Concluir a validação ponta a ponta de `send-push` e `check-due-bills` com um usuário descartável (bloqueado temporariamente pelo limite de e-mail do Supabase).
7. Confirmar que o próximo deploy da Vercel não contém mais referências ao projeto Supabase antigo (`nvskvrgsfzaynotdgzoy`) depois que o usuário atualizar as variáveis de ambiente lá.
