# Contexto e estado atual

Atualizado em 30/08/2026 (sessão Claude Code).

## Como continuar

Este arquivo, junto com `docs/lumnia-redesign-roadmap.md`, é a fonte de verdade sobre o que já foi feito e o que falta. Consulte o roadmap antes de iniciar qualquer etapa nova — ele tem uma tabela de progresso por etapa com evidências e pendências detalhadas, atualizada nesta mesma sessão.

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
| 3. Transações | Concluída e validada fisicamente pelo usuário em 30/08/2026 |
| 4. Planejamento | Concluída e validada |
| 5. Patrimônio | Concluída e validada pelo usuário em 30/08/2026 |
| 6. Analytics | Concluída e validada fisicamente pelo usuário em 30/08/2026 |
| 7. Configurações | Diagnóstico e correções parciais; importação Android já validada. Falta classificar as abas restantes (Perfil, Automação, Notificações, Categorias, Módulos, Planos) |
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
- Chat de IA dentro do app (`chat-genius`) e sugestão automática de categoria (`categorize-expense`) foram descontinuados em 30/08/2026: o secret de IA usado antes era provisionado automaticamente pela Lovable e não existe no projeto Supabase independente atual, e o usuário decidiu não contratar um provedor próprio por ora. O código permanece no repositório para uma eventual reativação futura.
- Integração MCP mantida apenas via Claude (Custom Connector, plano Pro) a partir de 30/08/2026; a integração com o ChatGPT foi abandonada por decisão do usuário.
- Notificações push (`send-push`) não são usadas no momento — falta o secret `VAPID_PRIVATE_KEY`, sem decisão tomada sobre reativar esse recurso.

## Pendências que não podem ser omitidas

1. Etapa 7: finalizar a classificação funcional, incompleta, futura ou removível das abas de Configurações restantes (Perfil, Automação, Notificações, Categorias, Módulos, Planos).
2. Etapas 8 e 9 do roadmap (movimento/estados e auditoria final) ainda não começaram.
3. Publicação na Play Store segue fora de escopo por decisão do usuário (conta do Google Play Console ainda não criada).
