import { useEffect, useRef, useState } from "react"
import { Link, NavLink, Outlet, useNavigate } from "react-router"
import { useCaminho, useT } from "../i18n"
import { temNivel, useAcesso, type Acesso } from "../lib/acesso"
import { sair, useAuth } from "../lib/sessao"
import { Erro } from "./Erro"
import { EscopoApp } from "./escopo"
import { Esqueleto } from "./Esqueleto"
import { Icone } from "./Icone"
import { Marca } from "./Marca"
import { SeletorIdioma } from "./SeletorIdioma"
import { Selo } from "./Selo"
import { focoApp, linkMenuApp, rotuloGrupoApp } from "./menuApp"
import { ABAS, AVATAR, MAIS, SIDEBAR, type Item } from "./navegacao"

// Casca do membro no molde do app do Linear (Decisão 55; telas-molde arquivadas no cofre do projeto):
// sidebar de 240px sobre o breu, conteúdo num painel carvão com hairline, itens de 13px com ícone de 16px, o item
// ativo com fundo creme/5 e ícone dourado. Elevação só por hairline; nenhuma sombra externa.
const foco = focoApp
const linkMenu = linkMenuApp
const rotuloGrupo = rotuloGrupoApp

// Item bloqueado por nível continua clicável (leva à página com a prévia, PRD §17.1); o leitor de tela ouve o motivo.
function LinkItem({ item, acesso }: { item: Item; acesso: Acesso }) {
  const t = useT()
  const caminho = useCaminho()
  if (item.soPremiado && !acesso.premiado) return null
  const pronto = !acesso.carregando && !acesso.erro
  const bloqueado = pronto && !!item.minimo && !temNivel(acesso.nivel, item.minimo)
  const dica = bloqueado ? t(item.minimo === "grupo" ? "menu.bloqueadoGrupo" : "menu.bloqueadoClube") : undefined
  const conteudo = (
    <>
      <Icone nome={item.icone} className="size-4 shrink-0" />
      <span className="flex-1 truncate">{t(item.rotulo)}</span>
      {bloqueado ? (
        <>
          <Icone nome="cadeado" className="size-3.5 shrink-0 text-cinza" />
          <span className="sr-only">{t(item.minimo === "grupo" ? "bloqueado.rotulo" : "bloqueado.rotuloClube")}</span>
        </>
      ) : null}
    </>
  )
  return item.externo ? (
    <a href={caminho(item.rota)} title={dica} className={linkMenu}>{conteudo}</a>
  ) : (
    <NavLink to={caminho(item.rota)} title={dica} className={linkMenu}>{conteudo}</NavLink>
  )
}

function CartaoPlano({ nivel }: { nivel: Acesso["nivel"] }) {
  const t = useT()
  const caminho = useCaminho()
  const grupo = nivel === "grupo"
  return (
    <Link to={caminho(grupo ? "/configuracoes/assinatura" : "/planos")} className={`block rounded-md bg-creme/2 px-3 py-2.5 text-legenda text-bruma shadow-borda transition-colors hover:text-creme ${foco}`}>
      {t(grupo ? "menu.cartao.grupo" : nivel === "clube" ? "menu.cartao.clube" : "menu.cartao.sem")}
    </Link>
  )
}

function Sidebar({ acesso }: { acesso: Acesso }) {
  const t = useT()
  const caminho = useCaminho()
  return (
    <aside className="app sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-3 overflow-y-auto bg-breu px-3 py-3 lg:flex">
      <Marca to={caminho("/inicio")} className="px-2" />
      <nav aria-label={t("menu.membro")} className="flex flex-1 flex-col">
        {SIDEBAR.map((g, i) => (
          <div key={i}>
            {g.rotulo ? <p className={rotuloGrupo}>{t(g.rotulo)}</p> : i > 0 ? <div className="h-4" /> : null}
            <ul className="space-y-0.5">
              {g.itens.map((item) => (
                <li key={item.rota}><LinkItem item={item} acesso={acesso} /></li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <CartaoPlano nivel={acesso.nivel} />
      <Link to={caminho("/suporte")} className={linkMenu}>
        <Icone nome="ajuda" className="size-4 shrink-0" />
        {t("menu.suporte")}
      </Link>
    </aside>
  )
}

// Popover do avatar: Esc fecha e devolve o foco ao botão; clicar fora ou sair do foco também fecha.
function MenuAvatar({ acesso }: { acesso: Acesso }) {
  const t = useT()
  const caminho = useCaminho()
  const { sessao } = useAuth()
  const navegar = useNavigate()
  const [aberto, setAberto] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  const botao = useRef<HTMLButtonElement>(null)
  const email = sessao?.user.email ?? ""

  useEffect(() => {
    if (!aberto) return
    const fora = (e: PointerEvent) => !raiz.current?.contains(e.target as Node) && setAberto(false)
    document.addEventListener("pointerdown", fora)
    return () => document.removeEventListener("pointerdown", fora)
  }, [aberto])

  async function sairDaConta() {
    await sair()
    navegar(caminho("/"), { replace: true })
  }

  return (
    <div
      ref={raiz}
      className="relative"
      onKeyDown={(e) => {
        if (e.key === "Escape" && aberto) {
          setAberto(false)
          botao.current?.focus()
        }
      }}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setAberto(false)}
    >
      <button ref={botao} type="button" aria-expanded={aberto} aria-label={t("menu.conta")} onClick={() => setAberto(!aberto)} className={`inline-flex size-8 items-center justify-center rounded-full bg-fumaca text-xs font-medium text-creme uppercase pointer-coarse:size-11 ${foco}`}>
        {email.charAt(0) || "?"}
      </button>
      {aberto ? (
        <div className="absolute right-0 z-30 mt-2 w-72 rounded-xl bg-obsidiana p-1 shadow-flutuante">
          <p className="truncate px-2 pt-1.5 text-legenda text-creme">{email}</p>
          <p className="flex flex-wrap items-center gap-2 px-2 pt-1 pb-2 text-xs text-nevoa">
            {t("nivel.rotulo")}: {t(`nivel.${acesso.nivel}`)}
            {acesso.premiado ? <Selo tom="dourado">{t("selo.premiado")}</Selo> : null}
          </p>
          <ul className="space-y-0.5 border-t border-grafite pt-1">
            {AVATAR.map((item) => (
              <li key={item.rota}><LinkItem item={item} acesso={acesso} /></li>
            ))}
            <li>
              <button type="button" onClick={sairDaConta} className={`${linkMenu} w-full text-left`}>
                <Icone nome="sair" className="size-4 shrink-0" />
                {t("menu.sair")}
              </button>
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  )
}

// Folha inferior "Mais" (mobile) em <dialog> nativo: foco preso, Esc fecha.
function FolhaMais({ acesso, aberta, fechar }: { acesso: Acesso; aberta: boolean; fechar: () => void }) {
  const t = useT()
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (aberta && !d.open) d.showModal()
    if (!aberta && d.open) d.close()
  }, [aberta])
  return (
    // Clicar no fundo (o próprio <dialog>, que não tem padding) fecha a folha.
    <dialog ref={ref} aria-label={t("menu.mais")} onClose={fechar} onClick={(e) => e.target === e.currentTarget && fechar()} className="app m-0 mt-auto w-full max-w-none rounded-t-xl bg-obsidiana p-0 text-creme shadow-flutuante backdrop:bg-breu/70 lg:hidden">
      <div className="p-3">
        <div className="flex items-center justify-between px-2 pb-2">
          <p className="text-base font-medium">{t("menu.mais")}</p>
          <button type="button" onClick={fechar} aria-label={t("comum.fechar")} className={`inline-flex size-11 items-center justify-center rounded-md text-nevoa hover:text-creme ${foco}`}>
            <Icone nome="fechar" className="size-5" />
          </button>
        </div>
        {/* Clicar num link navega e fecha a folha (o clique sobe até aqui). */}
        <ul onClick={fechar} className="space-y-0.5 [&_a]:min-h-11 [&_a]:text-base">
          {MAIS.map((item) => (
            <li key={item.rota}><LinkItem item={item} acesso={acesso} /></li>
          ))}
        </ul>
      </div>
    </dialog>
  )
}

function BarraAbas({ acesso }: { acesso: Acesso }) {
  const t = useT()
  const caminho = useCaminho()
  const [mais, setMais] = useState(false)
  const item = `relative flex min-h-14 min-w-11 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium text-nevoa aria-[current=page]:text-creme aria-[current=page]:before:absolute aria-[current=page]:before:inset-x-5 aria-[current=page]:before:top-0 aria-[current=page]:before:h-0.5 aria-[current=page]:before:rounded-full aria-[current=page]:before:bg-dourado [&[aria-current=page]>svg]:text-dourado ${foco}`
  return (
    <>
      <nav aria-label={t("menu.abas")} className="app fixed inset-x-0 bottom-0 z-20 flex border-t border-grafite bg-breu lg:hidden">
        {ABAS.map((a) => (
          <NavLink key={a.rota} to={caminho(a.rota)} className={item}>
            <Icone nome={a.icone} className="size-5" />
            {t(a.rotulo)}
          </NavLink>
        ))}
        <button type="button" aria-haspopup="dialog" aria-expanded={mais} onClick={() => setMais(true)} className={item}>
          <Icone nome="menu" className="size-5" />
          {t("menu.mais")}
        </button>
      </nav>
      <FolhaMais acesso={acesso} aberta={mais} fechar={() => setMais(false)} />
    </>
  )
}

// Layout da área do membro (PRD §17.3): sidebar no desktop, tab bar de 5 itens no celular, sino e avatar no topo.
// A proteção por login fica em App.tsx (RotaProtegida acima deste layout). A tela de dentro não renderiza <main>.
// Carregando/erro do acesso aparecem aqui; quando chega a tela, o nível já é conhecido (useAcesso).
// `conteudoPublico`: páginas públicas abertas com sessão (planos, biblioteca…) ficam com o visual público dentro
// da casca (Decisão 55): o escopo do app vale só para sidebar, topo e tab bar.
export function LayoutMembro({ conteudoPublico = false }: { conteudoPublico?: boolean }) {
  const t = useT()
  const caminho = useCaminho()
  const acesso = useAcesso()
  return (
    <EscopoApp value>
      <div className={`flex min-h-dvh bg-breu text-creme ${conteudoPublico ? "" : "app"}`}>
        <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:z-40 focus:m-2 focus:rounded-md focus:bg-creme focus:px-4 focus:py-3 focus:text-breu">{t("menu.pular")}</a>
        <Sidebar acesso={acesso} />
        <div className={`flex min-w-0 flex-1 flex-col lg:my-2 lg:mr-2 lg:rounded-xl lg:shadow-borda ${conteudoPublico ? "bg-fundo" : "bg-carvao"}`}>
          <header className={`app sticky top-0 z-20 flex h-12 items-center justify-between gap-3 px-4 sm:px-6 lg:rounded-t-xl ${conteudoPublico ? "bg-fundo" : "bg-carvao"}`}>
            <Marca to={caminho("/inicio")} className="max-sm:[&>span]:hidden lg:invisible" />
            <div className="flex items-center gap-1">
              <SeletorIdioma />
              <Link to={caminho("/notificacoes")} aria-label={t("menu.notificacoes")} title={t("menu.notificacoes")} className={`inline-flex size-9 items-center justify-center rounded-md text-nevoa transition-colors pointer-coarse:size-11 hover:bg-creme/5 hover:text-creme ${foco}`}>
                <Icone nome="sino" className="size-4" />
              </Link>
              <MenuAvatar acesso={acesso} />
            </div>
          </header>
          <main id="conteudo" tabIndex={-1} className="flex-1 pb-20 outline-none lg:pb-0">
            <EscopoApp value={!conteudoPublico}>
              {acesso.carregando ? <Esqueleto linhas={4} className="mx-auto max-w-3xl px-6 py-16" /> : acesso.erro ? (
                <div className="mx-auto max-w-3xl px-6 py-16"><Erro aoTentar={acesso.recarregar}>{t("acesso.erro")}</Erro></div>
              ) : (
                <Outlet />
              )}
            </EscopoApp>
          </main>
        </div>
        <BarraAbas acesso={acesso} />
      </div>
    </EscopoApp>
  )
}
