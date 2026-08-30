# Regras e requisitos não negociáveis

## Integridade financeira

1. `value` é sempre magnitude positiva. O tipo define o sinal financeiro.
2. Receita aumenta caixa; despesa reduz caixa.
3. Transferência entre carteiras não altera o patrimônio total, salvo entrada ou saída de investimento.
4. Compra no cartão não reduz caixa na compra. O caixa é reduzido no pagamento efetivo da fatura.
5. Saldos de conta e poupança são derivados de transações pagas, não de `wallets.current_balance`.
6. Em reconciliações, comparar registros normalizados e multiplicidade. Totais iguais não provam que os dados são iguais.
7. Nunca alterar dados reais, recriar base, importar em massa ou corrigir divergências sem escopo explícito e evidência item a item.

Campos mínimos para comparação de transações: `date`, `description`, `value`, `type`, `final_category`, `is_paid`, `payment_method`, `credit_card_id`, `wallet_id`, `invoice_month` e `is_recurring`.

## UI e UX

1. Priorizar leitura financeira, hierarquia e espaço em branco sobre efeitos decorativos.
2. Um gráfico principal por contexto. Não usar treemap e não usar gráficos circulares redundantes.
3. Valores completos devem aparecer fora do gráfico quando necessários para decisão.
4. Gráficos e previsões só existem com base de dados suficiente. Nunca simular série histórica ou insight genérico.
5. Validar dark, light, loading, vazio, erro, offline, textos longos, valores grandes, teclado, scroll, toque e retorno de modal.
6. Áreas de toque, contraste e texto devem ser acessíveis em Android.
7. Vidro é camada funcional, nunca fundo de conteúdo financeiro que reduza contraste.

## Processo de execução

1. Ler o roadmap e esta memória antes de iniciar etapa relacionada.
2. Não marcar etapa como concluída por código, build ou screenshot isolado. Exigir escopo completo, testes e dispositivo quando aplicável.
3. Preservar alterações do usuário em worktree sujo. Não usar `git reset --hard` ou checkout destrutivo.
4. Antes de apagar ou mover arquivos, inventariar, identificar referências e pedir autorização para remoções materiais.
5. Atualizar evidências e pendências reais no roadmap e nesta memória ao encerrar o trabalho.

## Dependências e infraestrutura

- O banco, autenticação e funções operam no Supabase próprio.
- Há integrações e código MCP ainda baseados em bibliotecas `@lovable`; não removê-los até a migração ser implementada e validada.
- Nunca expor tokens, chaves, credenciais ou URLs autenticadas.
