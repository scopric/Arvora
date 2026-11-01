import { Link, NavLink, Outlet } from "react-router"
import { useCaminho, useT } from "../i18n"
import { useAcesso } from "../lib/acesso"
import { Erro } from "./Erro"
import { EscopoApp } from "./escopo"
import { Esqueleto } from "./Esqueleto"
import { Icone } from "./Icone"
import { Mfa } from "./Mfa"
import { NaoEncontrada } from "./NaoEncontrada"
import { SeletorIdioma } from "./SeletorIdioma"
import { MENU_ADMIN } from "./navegacao"

// Mesma casca do membro (molde: configurações do app do Linear): sidebar no breu com grupos rotulados, conteúdo num
// painel carvão com hairline. O tema claro do PRD §17.7.2 saiu (Decisão 54).
const foco = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado"
const linkMenu = `flex h-8 items-center gap-2 rounded-md px-2 text-legenda font-medium text-nevoa transition-colors pointer-coarse:min-h-11 hover:bg-creme/5 hover:text-creme aria-[current=page]:bg-creme/5 aria-[current=page]:text-creme [&[aria-current=page]>svg]:text-dourado ${foco}`

function Menu() {
  const t = useT()
  const caminho = useCaminho()
  return (
    <nav aria-label={t("admin.menu")} className="flex flex-col">
      {MENU_ADMIN.map((g, i) => (
        <div key={i}>
          {g.rotulo ? <p className="px-2 pt-4 pb-1 text-[11px] font-medium text-nevoa">{t(g.rotulo)}</p> : null}
          <ul className="space-y-0.5">
            {g.itens.map((item) => (
              <li key={item.rota}>
                <NavLink to={caminho(item.rota)} end={item.rota === "/admin"} className={linkMenu}>
                  <Icone nome={item.icone} className="size-4 shrink-0" />
                  <span className="truncate">{t(item.rotulo)}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

// Barreira só de interface — o banco decide pelo papel e pelo aal2. Ordem: acesso lido → é equipe? (senão 404 na tela;
// os textos do admin vão no pacote JS, quem barra é o RLS) → 2FA (Mfa) → conteúdo. Erro de leitura aparece como erro,
// nunca como "sem acesso". No celular o menu abre num <details>.
export function LayoutAdmin() {
  const t = useT()
  const caminho = useCaminho()
  const acesso = useAcesso()

  if (acesso.carregando || acesso.erro) {
    return (
      <EscopoApp value>
        <div className="app min-h-dvh bg-breu text-creme">
          {acesso.carregando ? <Esqueleto linhas={4} className="mx-auto max-w-3xl px-6 py-16" /> : <div className="mx-auto max-w-3xl px-6 py-16"><Erro aoTentar={acesso.recarregar}>{t("acesso.erro")}</Erro></div>}
        </div>
      </EscopoApp>
    )
  }
  if (!acesso.equipe) return <NaoEncontrada />

  return (
    <EscopoApp value>
      <div className="app min-h-dvh bg-breu text-creme">
        <Mfa>
          <div className="flex min-h-dvh max-lg:flex-col">
            <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:z-40 focus:m-2 focus:rounded-md focus:bg-creme focus:px-4 focus:py-3 focus:text-breu">{t("menu.pular")}</a>
            <aside className="shrink-0 px-3 py-3 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-60 lg:flex-col lg:overflow-y-auto">
              <div className="flex items-center justify-between gap-2 px-2 py-1">
                <p className="flex items-center gap-2 text-[11px] font-medium text-nevoa">
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-dourado" />
                  {t("admin.faixa")}
                </p>
                <SeletorIdioma />
              </div>
              <Link to={caminho("/inicio")} className={`${linkMenu} mt-2`}>
                <Icone nome="seta" className="size-4 shrink-0" />
                {t("admin.voltar")}
              </Link>
              <details className="mt-2 lg:hidden">
                <summary className={`flex min-h-9 cursor-pointer list-none items-center justify-between rounded-md border border-grafite px-3 text-legenda font-medium text-bruma pointer-coarse:min-h-11 hover:text-creme ${foco}`}>
                  {t("menu.mais")}
                  <Icone nome="menu" className="size-4" />
                </summary>
                <div className="mt-2"><Menu /></div>
              </details>
              <div className="max-lg:hidden"><Menu /></div>
            </aside>
            <main id="conteudo" tabIndex={-1} className="min-w-0 flex-1 bg-carvao outline-none lg:my-2 lg:mr-2 lg:rounded-xl lg:shadow-borda">
              <Outlet />
            </main>
          </div>
        </Mfa>
      </div>
    </EscopoApp>
  )
}
