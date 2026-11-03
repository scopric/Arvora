import { NavLink, Outlet } from "react-router"
import { useCaminho, useT } from "../i18n"
import { useAcesso } from "../lib/acesso"
import { Erro } from "./Erro"
import { EscopoApp } from "./escopo"
import { Esqueleto } from "./Esqueleto"
import { Icone } from "./Icone"
import { Carregando } from "./Carregando"
import { Mfa } from "./Mfa"
import { useSairSeNaoForEquipe } from "../lib/sairDoPainel"
import { BotaoSair } from "./ContasSeparadas"
import { NaoEncontrada } from "./NaoEncontrada"
import { SeletorIdioma } from "./SeletorIdioma"
import { botaoPequenoApp } from "./botaoEstilo"
import { linkMenuApp, rotuloGrupoApp } from "./menuApp"
import { MENU_ADMIN } from "./navegacao"

// Admin mantém a sidebar (molde: configurações do app do Linear, tela 04b0ed10) sobre os tokens do MasterClass
// (Decisão 70): aside em carvão com grupos rotulados, conteúdo direto sobre o breu. O tema claro do PRD §17.7.2 saiu (Decisão 53).
const linkMenu = linkMenuApp

function Menu() {
  const t = useT()
  const caminho = useCaminho()
  return (
    <nav aria-label={t("admin.menu")} className="flex flex-col">
      {MENU_ADMIN.map((g, i) => (
        <div key={i}>
          {g.rotulo ? <p className={rotuloGrupoApp}>{t(g.rotulo)}</p> : null}
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
  const saindo = useSairSeNaoForEquipe(acesso.equipe, acesso.carregando, acesso.erro)

  if (acesso.carregando || acesso.erro) {
    return (
      <EscopoApp value>
        <div className="app min-h-dvh bg-breu text-creme">
          {acesso.carregando ? <Esqueleto linhas={4} className="mx-auto max-w-3xl px-6 py-16" /> : <div className="mx-auto max-w-3xl px-6 py-16"><Erro aoTentar={acesso.recarregar}>{t("acesso.erro")}</Erro></div>}
        </div>
      </EscopoApp>
    )
  }
  if (saindo) return <Carregando />
  if (!acesso.equipe) return <NaoEncontrada />

  return (
    <EscopoApp value>
      <div className="app min-h-dvh bg-breu text-creme">
        <Mfa>
          <div className="flex min-h-dvh max-lg:flex-col">
            <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:z-40 focus:m-2 focus:rounded-md focus:bg-creme focus:px-4 focus:py-3 focus:text-breu">{t("menu.pular")}</a>
            <aside className="shrink-0 bg-carvao px-3 py-3 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-60 lg:flex-col lg:overflow-y-auto">
              <div className="flex items-center justify-between gap-2 px-2 py-1">
                <p className="text-legenda font-semibold text-cinza">{t("admin.faixa")}</p>
                <SeletorIdioma />
              </div>
              <BotaoSair destino={caminho("/entrar")} className="mt-2 px-2" />
              <details className="mt-2 lg:hidden">
                <summary className={`${botaoPequenoApp} w-full cursor-pointer list-none justify-between`}>
                  {t("menu.mais")}
                  <Icone nome="menu" className="size-4" />
                </summary>
                <div className="mt-2"><Menu /></div>
              </details>
              <div className="max-lg:hidden"><Menu /></div>
            </aside>
            <main id="conteudo" tabIndex={-1} className="min-w-0 flex-1 outline-none">
              <Outlet />
            </main>
          </div>
        </Mfa>
      </div>
    </EscopoApp>
  )
}
