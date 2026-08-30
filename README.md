# Lumnia

Aplicativo pessoal de finanças com versão web em Vite/React e aplicativo Android empacotado com Capacitor.

## Stack

- React, TypeScript, Vite e Tailwind CSS
- Supabase para autenticação, dados e funções de servidor
- Capacitor para Android
- pnpm `11.19.0` como gerenciador de pacotes oficial

## Estrutura do projeto

```text
android/     Projeto nativo Android e recursos do aplicativo
design/      Fontes de design, identidade visual e materiais de publicação
docs/        Roadmap, auditorias, evidências de validação e histórico
public/      Arquivos estáticos usados pela aplicação web e PWA
scripts/     Scripts de manutenção e build do MCP
src/         Aplicação React
supabase/    Migrações e funções de servidor
```

## Desenvolvimento local

Requisitos: Node.js 22 ou superior e pnpm 11.19.0.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Validações principais:

```sh
pnpm typecheck
pnpm test
pnpm quality
```

## Android

As instruções completas estão em [ANDROID.md](ANDROID.md). Para preparar o projeto nativo após uma alteração web:

```sh
pnpm android:prepare
```

O fluxo de publicação e validação do redesign está em [docs/lumnia-redesign-roadmap.md](docs/lumnia-redesign-roadmap.md).

## Continuidade para IAs

A memória operacional, regras, incidentes e procedimentos de entrega ficam em [docs/ai-memory/](docs/ai-memory/README.md). Qualquer agente deve ler essa pasta e o roadmap antes de alterar o projeto.

## Observação sobre integrações legadas

O banco e a autenticação do aplicativo estão no Supabase próprio. Há dependências `@lovable` preservadas temporariamente no MCP e em integrações específicas; elas não devem ser removidas sem uma migração validada dessas funções.
