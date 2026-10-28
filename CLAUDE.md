# Árvora — instruções do repositório

Repositório de código da plataforma Grupo Árvora (`scopric/Arvora`). Fica em `~/Code/arvora`, fora do iCloud, de propósito.

## Leia antes de mexer

Notas do cofre (pasta `Conhecimento`):
`<cofre do projeto>/Conhecimento/`

- `Erros que não se repetem.md`: lições pagas no projeto anterior. Erro novo entra no fim, com **O que houve** e **Regra**.
- `O que não pode quebrar.md`: lista curta e checklist antes de cada merge.
- `Stack e convenções.md`
- `Deploy e CI.md`

Decisões e plano da fase: `<cofre do projeto>/Decisões.md` e `<cofre do projeto>/Claude/Planos/`.

## As 5 regras centrais

1. **Segredos:** nunca no código nem em commit. Só em `.env.local` (fora do git) e na Vercel. Sem variável, o código falha à vista, sem chave reserva.
2. **Migrations:** uma pasta (`supabase/migrations`), incrementais, testadas num banco vazio. **Nunca `db push`.** Conferir o banco real, só leitura.
3. **Sessão única:** uma fonte só (`onAuthStateChange`). `signOut({ scope: 'local' })`. Erro aparece na tela, nunca vira lista vazia.
4. **Deploy por merge:** produção só por merge no `main` com CI verde. Sem Vercel CLI, sem `git add .` às cegas, sem commit falso para forçar deploy. Conferir o deploy depois do merge.
5. **UPDATE sob RLS:** sempre `.select('id')` e tratar resposta vazia como erro.

## Convenções

- Node 24 (`.nvmrc`). Versões exatas no `package.json` (`save-exact` no `.npmrc` do projeto). Nunca rodar `npm config set` sem `--location=project`.
- Antes de commitar: `npm run lint && npm run typecheck && npm run build`.
- Commits pequenos, em pt-BR. Trabalho em branch, PR para `main`.
- Sem analytics, sem CDN de fontes (GDPR). Fontes via `@fontsource-variable`.
