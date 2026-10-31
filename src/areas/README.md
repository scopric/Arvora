# Áreas da plataforma

Cada pessoa mexe só na sua área. O que é compartilhado (layouts, componentes comuns, `App.tsx`, `src/i18n/index.ts`) é da base: pedir mudança, não editar.

| Área | Rotas | Layout | Arquivos que a área edita |
|---|---|---|---|
| `publico` | `/planos`, `/suporte`, `/termos`, `/directory`... | `LayoutPublico` (topo e rodapé) | `src/areas/publico/**`, `src/i18n/areas/publico.{pt,en}.ts` |
| `aprender` | `/inicio`, `/aulas`, `/academy`, `/tarefas`, `/bem-estar`... | `LayoutMembro` | `src/areas/aprender/**`, `src/i18n/areas/aprender.{pt,en}.ts` |
| `rede` | `/comunidade`, `/network`, `/match`, `/conexoes`, `/meu-award` | `LayoutMembro` | `src/areas/rede/**`, `src/i18n/areas/rede.{pt,en}.ts` |
| `conta` | `/notificacoes`, `/configuracoes/*` | `LayoutMembro` | `src/areas/conta/**`, `src/i18n/areas/conta.{pt,en}.ts` |
| `admin` | `/admin/*` | `LayoutAdmin` (equipe + 2FA) | `src/areas/admin/**`, `src/i18n/areas/admin.{pt,en}.ts` |

## Entregar uma tela

1. Crie a tela em `src/areas/<area>/telas/Nome.tsx`. **Não renderize `<main>`**: o layout já tem (`id="conteudo"`). Comece com um `<h1>` e chame `useTitulo("<area>.<tela>.titulo")`.
2. Em `src/areas/<area>/rotas.tsx`, troque `<EmConstrucao titulo="..." />` pela sua tela. Caminhos são relativos a `/:lang` (admin: a `/:lang/admin`).
3. Textos: em `src/i18n/areas/<area>.pt.ts` e `.en.ts`, sempre com o prefixo `<area>.` (ex.: `aprender.aula.entrar`). O `.en.ts` é tipado contra o `.pt.ts`: faltou chave, não compila. Use `const t = useT()` e `t("aprender.aula.entrar")`. Chave repetida entre áreas é barrada em `src/i18n/i18n.test.tsx`.
4. Links: `const caminho = useCaminho()` e `<Link to={caminho("/aulas")}>`.
5. Acesso: `const { nivel, premiado, equipe, carregando, erro, recarregar } = useAcesso()` (`src/lib/acesso.ts`). Trate `carregando` (use `<Esqueleto />`) e `erro` (use `<Erro aoTentar={recarregar} />`) antes de decidir; erro nunca vira "sem acesso". Conteúdo acima do nível: `<Bloqueado ... />`. Quem barra de verdade é o RLS; o front só escolhe o que mostrar.
6. Teste: um por tela/componente com lógica; telas novas entram na lista de `src/a11y.test.tsx` (axe).

Textos que são promessa comercial levam `// PROVISÓRIO`. Dourado só no braço Brazilian Awards. Sem `console.log`, sem segredo, sem nome de pessoa real (repositório público).
