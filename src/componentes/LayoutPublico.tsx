import { Link, Outlet, useLocation } from "react-router"
import { useCaminho, useT } from "../i18n"
import { useAuth } from "../lib/sessao"
import { LayoutMembro } from "./LayoutMembro"
import { Marca } from "./Marca"
import { SeletorIdioma } from "./SeletorIdioma"

export const linkPublico =
  "inline-flex min-h-11 items-center rounded-lg px-4 text-creme transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado"
export const botaoPublico =
  "inline-flex min-h-12 items-center justify-center rounded-lg px-7 text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado"

// Topo e rodapé da home (extraídos de EmBreve sem mudar o visual). `completo` acrescenta o menu do site público (PRD §17.3.1),
// usado nas demais páginas públicas; a home segue como estava.
// Hall of Fame é página pré-renderizada fora do app: <a> comum (carga nova), não <Link>.
function ItensMenu() {
  const t = useT()
  const caminho = useCaminho()
  return (
    <>
      <a href={caminho("/hall-of-fame")} className={linkPublico}>{t("menu.hallOfFame")}</a>
      <Link to={caminho("/directory")} className={linkPublico}>{t("menu.directory")}</Link>
      <Link to={caminho("/biblioteca")} className={linkPublico}>{t("menu.biblioteca")}</Link>
      <Link to={caminho("/planos")} className={linkPublico}>{t("menu.planos")}</Link>
    </>
  )
}

export function TopoPublico({ completo = false }: { completo?: boolean }) {
  const { sessao, carregando } = useAuth()
  const t = useT()
  const caminho = useCaminho()
  return (
    <header className="sticky top-0 z-20 border-b border-creme/10 bg-fundo/75 backdrop-blur-md">
      <div className="flex min-h-17 items-center justify-between gap-3 px-4 sm:px-12 lg:px-20">
        <Marca to={caminho("/")} className="max-sm:[&>span]:hidden" />
        {completo ? (
          <nav aria-label={t("nav.principal")} className="hidden items-center gap-1 text-sm font-semibold md:flex">
            <ItensMenu />
          </nav>
        ) : null}
        <nav aria-label={completo ? t("menu.conta") : t("nav.principal")} className="flex items-center gap-2 text-sm font-semibold">
          <SeletorIdioma />
          {carregando ? null : sessao ? (
            <Link to={caminho(completo ? "/inicio" : "/perfil")} className={linkPublico}>{t(completo ? "menu.painel" : "nav.perfil")}</Link>
          ) : (
            <>
              <Link to={caminho("/entrar")} className={linkPublico}>{t("nav.entrar")}</Link>
              <Link to={caminho(completo ? "/planos" : "/cadastro")} className={`${botaoPublico} min-h-11 bg-creme px-5 text-sm whitespace-nowrap text-fundo hover:bg-white max-sm:hidden`}>{t(completo ? "menu.assinar" : "nav.criarConta")}</Link>
            </>
          )}
        </nav>
      </div>
      {completo ? (
        <nav aria-label={t("menu.abas")} className="flex gap-1 overflow-x-auto px-4 text-sm font-semibold md:hidden">
          <ItensMenu />
        </nav>
      ) : null}
    </header>
  )
}

export function RodapePublico({ completo = false }: { completo?: boolean }) {
  const { sessao, carregando } = useAuth()
  const t = useT()
  const caminho = useCaminho()
  return (
    <footer className="border-t border-creme/10 px-6 py-12 sm:px-16 lg:px-24">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xs">
          <Marca to={caminho("/")} />
          <p className="mt-4 text-sm text-creme/70">{t("auth.layout.apoio")}</p>
        </div>
        <nav aria-label={t("nav.rodape")} className="flex flex-wrap gap-x-2 text-sm font-semibold">
          {!carregando && !sessao && (
            <>
              <Link to={caminho("/entrar")} className={linkPublico}>{t("nav.entrar")}</Link>
              <Link to={caminho("/cadastro")} className={linkPublico}>{t("nav.criarConta")}</Link>
            </>
          )}
          {completo ? (
            <>
              <Link to={caminho("/suporte")} className={linkPublico}>{t("menu.suporte")}</Link>
              <Link to={caminho("/termos")} className={linkPublico}>{t("publico.termos.titulo")}</Link>
              <Link to={caminho("/privacidade")} className={linkPublico}>{t("publico.privacidade.titulo")}</Link>
            </>
          ) : null}
          <Link to={caminho("/cookies")} className={linkPublico}>{t("cookies.politica")}</Link>
        </nav>
      </div>
      <p className="mx-auto mt-10 max-w-6xl font-mono text-xs tracking-[0.15em] text-creme/60">© Grupo Árvora</p>
    </footer>
  )
}

// Páginas de conteúdo que, com sessão, abrem dentro da casca do membro (PRD §17.2.2: "logado, a página muda de estado").
// Termos, privacidade e checkout seguem com o topo público.
const COM_CASCA_DO_MEMBRO = new Set(["awards", "biblioteca", "originals", "directory", "evento", "suporte", "planos"])

// Layout das páginas públicas (PRD §17.2.1). A tela de dentro não renderiza <main>: ele é daqui (id="conteudo", alvo do "pular").
// Com sessão, as rotas de conteúdo acima usam o LayoutMembro (sidebar/abas); visitante e as demais ficam com o topo público.
export function LayoutPublico() {
  const t = useT()
  const { sessao } = useAuth()
  const segmento = useLocation().pathname.split("/")[2]
  // O miolo mantém o visual público (Decisão 55): só a casca fica no escopo do app.
  if (sessao && COM_CASCA_DO_MEMBRO.has(segmento)) return <LayoutMembro conteudoPublico />
  return (
    <div className="min-h-dvh">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:z-30 focus:m-2 focus:rounded-lg focus:bg-creme focus:px-4 focus:py-3 focus:text-fundo">{t("menu.pular")}</a>
      <TopoPublico completo />
      <main id="conteudo" tabIndex={-1}>
        <Outlet />
      </main>
      <RodapePublico completo />
    </div>
  )
}
