# Campos de valor sem fundo cinza + "Maiores Compras" legível

## 1. Campo de valor nos modais

Hoje o bloco do valor usa um preenchimento cinza (`bg-foreground/[0.04]` no componente e `--modal-field` forçado no CSS do `.glass-modal`). Ele passa a ser totalmente transparente, mantendo só a borda fina colorida por tipo (verde/vermelho/roxo) e o realce da borda ao focar.

- `src/components/AddExpenseModal.tsx` e `src/components/EditExpenseModal.tsx`: trocar o fundo do `value-box` por transparente.
- `src/index.css`: na regra `.glass-modal .value-box`, remover o `background-color` cinza (fundo transparente) e manter o estado de foco atual.

Resultado: o número grande fica direto sobre o vidro do modal, sem o retângulo cinza.

## 2. Gráfico "Maiores Compras"

O problema é estrutural: os nomes ficam num eixo estreito (52px) e são desenhados por cima das barras, quebrando em duas linhas e sobrepondo tanto no desktop quanto no mobile.

Em vez de continuar brigando com o eixo do gráfico, o card passa a ser um ranking em linhas (mesma linguagem visual das barras atuais, sem eixos):

```text
1  Pagamento fatura Nubank                R$ 3.622,61
   ██████████████████████████████
2  Limite convertido                      R$ 3.397,18
   ████████████████████████████
```

Cada item tem:
- Nome em uma única linha, truncado com `...` no fim quando longo (título completo no hover/toque).
- Valor formatado alinhado à direita, nunca sobreposto ao nome.
- Barra proporcional ao maior valor, com o mesmo gradiente por posição já usado hoje.

Isso elimina qualquer sobreposição e aproveita a largura total do card — no mobile o nome ganha a largura inteira em vez dos 52px do eixo.

## Detalhes técnicos

- `src/components/analytics/TopExpensesList.tsx`: substituir o `BarChart`/`YAxis`/`LabelList` do Recharts por uma lista com barras em CSS (largura = `value / maxValue`), preservando o filtro atual (`type === 'expense'`, exclui ajustes de saldo), o top 5, o `Card`, o título e o `InfoPopover`.
- Cores: reaproveitar os gradientes já definidos (primary, destructive, success, accent, chart-5) como tokens semânticos, sem cores fixas.
- Nenhuma mudança em dados, hooks ou cálculos financeiros.
