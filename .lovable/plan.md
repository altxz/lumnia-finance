# Refinamento visual e estados da interface

Objetivo: concluir a aplicação do novo design system nos cards, janelas, autenticação, gráficos, carregamentos e mensagens de feedback, preservando integralmente as regras financeiras e os fluxos existentes.

## Estado atual confirmado

- Os cards já usam a superfície `.glass` por padrão, enquanto dialogs, drawers, sheets, menus e popovers repetem combinações próprias de transparência e desfoque.
- A autenticação ainda usa fundo sólido, validação HTML básica e mensagens apenas por toast, sem erro contextual nos campos.
- Existem 22 componentes com Recharts, com tooltips, legendas e eixos definidos localmente de formas diferentes; o componente compartilhado de gráficos ainda não é adotado por eles.
- A tabela de despesas e alguns gráficos usam texto de “Carregando...” ou retornam conteúdo vazio, causando mudança de altura quando os dados chegam.
- Dois sistemas de toast estão montados ao mesmo tempo. O toast legado aparece em 27 arquivos, enquanto alguns erros já usam Sonner.
- As confirmações de exclusão usam `AlertDialog`, mas repetem estrutura e estilos em vários fluxos.

## 1. Superfícies de vidro

- Consolidar tokens de vidro, borda, overlay e sombras no tema global para modo claro e escuro.
- Aplicar a mesma linguagem visual aos primitives de `Card`, `Dialog`, `Drawer`, `Sheet`, `AlertDialog`, `Popover`, `Tooltip`, menus e selects.
- Preservar legibilidade em conteúdos densos com variantes `glass`, `glass-soft` e `solid`, evitando transparência excessiva em tabelas e formulários extensos.
- Manter os modais com altura máxima de `85dvh`, rolagem nativa, rodapé fixo e safe area no celular.

## 2. Login e cadastro

- Refatorar a tela de autenticação com o fundo, card de vidro, tipografia Poppins, espaçamentos, campos e botões do novo design system.
- Organizar login e cadastro como estados do mesmo formulário, com transição discreta e dimensões estáveis em desktop e celular.
- Usar `react-hook-form` e validação com Zod para nome, e-mail e senha, exibindo erros abaixo do campo, `aria-invalid`, borda/ring de erro e foco no primeiro campo inválido.
- Padronizar os estados carregando, desabilitado, erro, sucesso e conexão com Google; manter o redirecionamento seguro já existente.
- Não alterar regras de autenticação, criação de conta ou confirmação de e-mail.

## 3. Sistema compartilhado para gráficos

- Evoluir o componente-base de gráficos com tooltip de vidro, legenda compacta e propriedades comuns de eixo: Poppins, cor semântica, linhas discretas, formatação numérica e comportamento responsivo.
- Criar formatadores reutilizáveis para moeda, milhares, porcentagem e datas, evitando variações entre gráficos.
- Migrar os 22 componentes Recharts para os padrões compartilhados, preservando dados, cálculos, domínios específicos e formatos mobile já implementados.
- Remover tooltips locais duplicados e cores visuais fixas quando houver token semântico equivalente.
- Verificar truncamento, sobreposição e densidade das legendas/eixos em 393px e desktop.

## 4. Skeletons e estados de carregamento

- Melhorar o primitive `Skeleton` com brilho suave, superfície translúcida e respeito a `prefers-reduced-motion`.
- Criar skeletons reutilizáveis para cards, gráficos, linhas de tabela, formulários/modais e mensagens da IA, sempre com dimensões estáveis.
- Substituir os textos isolados de carregamento da tabela de despesas por linhas skeleton equivalentes no desktop e cards skeleton no celular.
- Aplicar placeholders estruturais nos gráficos e áreas de cálculo que hoje ficam vazios ou mudam de altura.
- Nos modais, preservar cabeçalho, corpo e rodapé durante buscas e salvamentos; usar indicador no botão sem trocar sua largura.
- Na categorização e no chat com IA, mostrar loading contextual no espaço da futura resposta, sem bloquear ou deslocar toda a interface.

## 5. Feedbacks, toasts e confirmações

- Unificar todos os fluxos no Sonner e remover a montagem concorrente do toast legado.
- Definir um padrão visual único para sucesso, erro, aviso e informação, com ícone, título, descrição, ação opcional, vidro, sombra e contraste coerentes com o tema.
- Centralizar mensagens técnicas amigáveis e PT-BR, incluindo falhas de rede, sessão, validação e IA.
- Migrar os usos existentes, incluindo salvar/editar/excluir despesas, importação, carteira, investimentos, configurações e categorias.
- Padronizar `AlertDialog` e criar uma confirmação reutilizável para exclusões simples, destrutivas e recorrentes, mantendo as escolhas específicas como “apenas esta” e “todas as recorrências”.
- Manter erros da IA também no contexto onde ocorreram; usar toast como reforço apenas quando exigir atenção ou ação do usuário.

## 6. Verificação

- Validar login, cadastro, Google, salvar despesa, falha de IA e exclusões simples/recorrentes.
- Revisar visualmente dashboard, Analytics, tabela de despesas e modais em desktop e celular (393px), nos modos claro e escuro.
- Confirmar navegação por teclado, foco, leitores de tela, contraste e ausência de sobreposição ou saltos relevantes de layout.
- Executar testes existentes e conferir o build final.

## Notas técnicas

- A implementação começa pelos tokens e primitives; as telas herdam o padrão antes da migração dos usos locais.
- Os componentes compartilhados novos serão pequenos e focados: presets de gráfico, skeletons estruturais e confirmação destrutiva.
- Nenhuma query, regra financeira, cálculo, política de acesso ou estrutura do banco de dados será alterada.
