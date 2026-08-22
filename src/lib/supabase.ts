// Um ÚNICO cliente Supabase em todo o app.
//
// Antes havia duas instâncias (esta e a de `@/integrations/supabase/client`)
// a partilhar a mesma chave de sessão no localStorage. As duas disputavam o
// cadeado de sessão e renovavam o token em paralelo, o que travava a página
// de autorização OAuth ("Carregando autorização...") e invalidava a sessão
// usada pelo conector MCP (ChatGPT).
export { supabase } from '@/integrations/supabase/client';
