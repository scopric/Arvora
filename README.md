# Árvora

Plataforma do Grupo Árvora: cursos, acompanhamento e uma comunidade para empreendedores brasileiros que constroem negócios fora do Brasil. O site é bilíngue (português e inglês, `/pt` e `/en`).

> **Estado:** em desenvolvimento. Contas, perfil, assinaturas com Stripe (**só em modo de teste**), exportação e exclusão de dados pessoais já existem; ainda não há cobrança real.
> **Licença:** sem licença pública. O código é visível, mas todos os direitos são reservados.

## O que há aqui

- **Site e área de membros** (`src/`): React 19, React Router 8, TypeScript estrito, Tailwind 4, Vite 8. Páginas públicas pré-renderizadas; validação de formulários com Zod.
- **Banco e autenticação** (`supabase/`): Postgres com Row Level Security, Supabase Auth, migrations incrementais e testes de banco (pgTAP).
- **Funções de borda** (`supabase/functions/`, Deno): checkout e portal do cliente (Stripe), webhook do Stripe, exclusão de conta.
- **E-mails de autenticação** (`supabase/templates/`): bilíngues, com a marca.

## Requisitos

- Node 24 (veja `.nvmrc`)
- Docker (para o Supabase local)
- [Deno](https://deno.com) (só para testar as funções de borda)

## Rodar localmente

```bash
npm ci
# Banco local (sobe o Postgres, o Auth e o Mailpit, que recebe os e-mails de teste)
npx supabase start -x realtime,storage-api,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
cp .env.example .env.local        # preencha VITE_SUPABASE_PUBLISHABLE_KEY com o valor de `npx supabase status`
npm run dev                       # http://localhost:5190
```

Os e-mails de cadastro e de recuperação de senha chegam ao Mailpit local, em http://127.0.0.1:55324. O `.env.local` nunca vai para o git.

## Verificações

```bash
npm run lint && npm run typecheck && npm test && npm run build   # site
npx supabase test db                                              # banco (pgTAP)
cd supabase/functions/<função> && deno fmt --check . && deno check index.ts && deno test   # funções de borda
```

Depois de mudar uma migration, regenere os tipos do banco: `npm run types:gerar` (o CI confere se o arquivo gerado bate).

## Estrutura

| Pasta | O que tem |
|---|---|
| `src/telas`, `src/componentes` | Telas e componentes de interface |
| `src/i18n` | Dicionários pt e en (as duas línguas têm de ter as mesmas chaves) |
| `src/lib` | Acesso ao Supabase, validação, tipos do banco gerados |
| `supabase/migrations` | Schema do banco, uma migration por mudança |
| `supabase/tests/database` | Testes de banco (RLS, funções, webhook) |
| `supabase/functions` | Funções de borda e código compartilhado (`_shared`) |

## Como trabalhamos

- A `main` é protegida: toda mudança entra por pull request com o CI verde (`verificar`, `funcoes` e `banco`).
- **Nunca** coloque segredo no código, em commit, em PR ou em issue: este repositório é público. Segredos ficam em `.env.local` (fora do git) e nos segredos da Vercel e do Supabase.
- Migrations são sempre novas e incrementais, testadas num banco vazio. Nada de `supabase db push`.
- Regras de segurança e convenções para quem contribui: veja o `CLAUDE.md`.

## Segurança

Se encontrar uma vulnerabilidade, **não abra uma issue pública** com os detalhes: fale diretamente com quem mantém o projeto.
