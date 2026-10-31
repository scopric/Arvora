import { Link, NavLink, Outlet } from "react-router"
import { useCaminho, useT } from "../i18n"
import { useAcesso } from "../lib/acesso"
import { Erro } from "./Erro"
import { Esqueleto } from "./Esqueleto"
import { Mfa } from "./Mfa"
import { NaoEncontrada } from "./NaoEncontrada"
import { SeletorIdioma } from "./SeletorIdioma"
import { MENU_ADMIN } from "./navegacao"

const foco = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado"
const linkMenu = `flex min-h-11 items-center rounded-lg px-3 text-creme/80 transition-colors hover:bg-creme/10 hover:text-white aria-[current=page]:bg-creme/12 aria-[current=page]:text-white ${foco}`

function Menu() {
  const t = useT()
  const caminho = useCaminho()
  return (
    <nav aria-label={t("admin.menu")} className="flex flex-col gap-3">
      {MENU_ADMIN.map((g, i) => (
        <div key={i}>
          {g.rotulo ? <p className="px-3 pb-1 font-mono text-xs font-semibold tracking-[0.2em] text-destaque uppercase">{t(g.rotulo)}</p> : null}
          <ul>
            {g.itens.map((item) => (
              <li key={item.rota}>
                <NavLink to={caminho(item.rota)} end={item.rota === "/admin"} className={linkMenu}>{t(item.rotulo)}</NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

// Casca do admin (PRD §17.3.4): sidebar escura, conteúdo em tema claro (classe tema-claro inverte as cores em index.css).
// Barreira só de interface — o banco decide pelo papel e pelo aal2. Ordem: acesso lido → é equipe? (senão 404 na tela; os textos do admin vão no pacote JS, quem barra é o RLS)
// → 2FA (Mfa) → conteúdo. Erro de leitura aparece como erro, nunca como "sem acesso". No celular o menu abre num <details>.
export function LayoutAdmin() {
  const t = useT()
  const caminho = useCaminho()
  const acesso = useAcesso()

  if (acesso.carregando) return <Esqueleto linhas={4} className="mx-auto max-w-3xl px-6 py-16" />
  if (acesso.erro) return <div className="mx-auto max-w-3xl px-6 py-16"><Erro aoTentar={acesso.recarregar}>{t("acesso.erro")}</Erro></div>
  if (!acesso.equipe) return <NaoEncontrada />

  return (
    <Mfa>
      <div className="flex min-h-dvh max-lg:flex-col">
        <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:z-40 focus:m-2 focus:rounded-lg focus:bg-creme focus:px-4 focus:py-3 focus:text-fundo">{t("menu.pular")}</a>
        <aside className="shrink-0 bg-fundo text-creme lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:overflow-y-auto">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-creme/10 px-4 py-3">
            <p className="font-mono text-xs font-semibold tracking-[0.3em] text-destaque uppercase">{t("admin.faixa")}</p>
            <SeletorIdioma className="max-lg:ml-auto" />
          </div>
          <div className="p-3">
            <Link to={caminho("/inicio")} className={`${linkMenu} mb-3`}>{t("admin.voltar")}</Link>
            <details className="lg:hidden">
              <summary className={`${linkMenu} cursor-pointer list-none`}>{t("menu.mais")}</summary>
              <div className="mt-2"><Menu /></div>
            </details>
            <div className="max-lg:hidden"><Menu /></div>
          </div>
        </aside>
        <main id="conteudo" tabIndex={-1} className="tema-claro min-w-0 flex-1 bg-fundo text-creme outline-none">
          <Outlet />
        </main>
      </div>
    </Mfa>
  )
}
