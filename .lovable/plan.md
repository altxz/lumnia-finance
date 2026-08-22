# Corrigir o conector do ChatGPT e a tela "Carregando autorização..."

## O que está acontecendo

O app cria **dois clientes de autenticação diferentes** apontando para o mesmo banco:

- `src/lib/supabase.ts` — usado por ~30 arquivos (páginas, hooks, AuthContext)
- `src/integrations/supabase/client.ts` — usado por 8 arquivos, incluindo a **página de autorização** do conector

Como os dois usam a mesma chave de sessão no navegador, eles disputam o mesmo "cadeado" de sessão. Consequências observadas:

1. A página `/.lovable/oauth/consent` chama `getSession()` / `refreshSession()`; quando o cadeado fica preso pelo outro cliente, a chamada nunca responde — a tela fica eternamente em "Carregando autorização...", sem erro.
2. Os dois clientes renovam a sessão em paralelo e um invalida o token do outro. Isso derruba a sessão que o conector do ChatGPT usa, e ele "para de se comunicar".

Verificado nesta análise: o servidor OAuth do projeto está habilitado, com a URL de consentimento e a lista de domínios corretas, e as ferramentas MCP respondem com sucesso quando recebem um token válido. Ou seja, o problema é do lado do app, não da configuração do conector.

## Solução

### 1. Um único cliente de autenticação (correção da causa raiz)
- Transformar `src/lib/supabase.ts` em um simples re-export de `src/integrations/supabase/client.ts` (arquivo oficial, não editável), para que todo o app compartilhe uma única instância e um único gerenciador de sessão.
- Assim desaparecem a disputa de cadeado e as renovações concorrentes de token.

### 2. Deixar a página de autorização à prova de travamento
Em `src/pages/OAuthConsentPage.tsx`:
- Aplicar um limite de tempo (10s) em cada chamada de sessão/autorização: se estourar, mostrar mensagem clara com botões "Tentar novamente" e "Entrar novamente" em vez de ficar carregando.
- Envolver o fluxo em tratamento de erro para que qualquer exceção inesperada apareça na tela.
- Mostrar um botão "Limpar sessão e tentar de novo" que apaga a sessão local e reinicia a autorização — resolve o caso de sessão corrompida no celular/PWA.

### 3. Garantir que o service worker não interfira
- Confirmar/ajustar em `vite.config.ts` que as rotas `/.lovable/**` e as chamadas ao `/auth/v1/**` fiquem fora do cache do PWA (NetworkOnly), para o consentimento nunca ser servido de cache antigo.

### 4. Validação
- Rodar a suíte de testes e o build.
- Abrir `/.lovable/oauth/consent` sem `authorization_id` e com um id inválido para confirmar que a tela sempre sai do estado de carregamento.
- Depois de publicar: reconectar o conector no ChatGPT (a lista de ferramentas e o token ficam em cache até a reconexão) e testar uma chamada como "resumo do mês".

## Detalhes técnicos

- `src/lib/supabase.ts` passa a ser `export { supabase } from "@/integrations/supabase/client";` (sem `createClient` próprio). Nenhum import existente precisa mudar.
- O cliente oficial já usa `localStorage`, `persistSession` e `autoRefreshToken`, então o comportamento atual do login é preservado.
- Timeout implementado com `Promise.race` sobre `getSession`, `refreshSession`, `getAuthorizationDetails` e `approve/denyAuthorization`.
- Nenhuma mudança de banco de dados, de RLS ou nas ferramentas MCP (versão 0.5.3 permanece).
