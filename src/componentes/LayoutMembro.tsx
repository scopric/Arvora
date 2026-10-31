import { useEffect, useRef, useState } from "react"
import { Link, NavLink, Outlet, useNavigate } from "react-router"
import { useCaminho, useT } from "../i18n"
import { temNivel, useAcesso, type Acesso } from "../lib/acesso"
import { sair, useAuth } from "../lib/sessao"
import { Erro } from "./Erro"
import { Esqueleto } from "./Esqueleto"
import { Icone } from "./Icone"
import { Marca } from "./Marca"
import { SeletorIdioma } from "./SeletorIdioma"
import { Selo } from "./Selo"
import { ABAS, AVATAR, MAIS, SIDEBAR, type Item } from "./navegacao"

const foco = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado"
const linkMenu = `flex min-h-11 items-center gap-2 rounded-lg px-3 text-creme/80 transition-colors hover:bg-creme/10 hover:text-white aria-[current=page]:bg-creme/12 aria-[current=page]:text-white ${foco}`

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
      <span className="flex-1">{t(item.rotulo)}</span>
      {bloqueado ? (
        <>
          <Icone nome="cadeado" className="size-4 shrink-0" />
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
    <Link to={caminho(grupo ? "/configuracoes/assinatura" : "/planos")} className={`block rounded-xl border border-creme/15 bg-superficie/25 p-4 text-sm font-semibold ${foco}`}>
      {t(grupo ? "menu.cartao.grupo" : nivel === "clube" ? "menu.cartao.clube" : "menu.cartao.sem")}
    </Link>
  )
}

function Sidebar({ acesso }: { acesso: Acesso }) {
  const t = useT()
  const caminho = useCaminho()
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-4 overflow-y-auto border-r border-creme/10 px-3 py-4 lg:flex">
      <Marca to={caminho("/inicio")} className="px-3" />
      <nav aria-label={t("menu.membro")} className="flex flex-1 flex-col gap-4">
        {SIDEBAR.map((g, i) => (
          <div key={i} className="border-t border-creme/10 pt-3 first:border-t-0 first:pt-0">
            {g.rotulo ? <p className={`px-3 pb-1 font-mono text-xs font-semibold tracking-[0.2em] uppercase ${g.dourado ? "text-dourado" : "text-destaque"}`}>{t(g.rotulo)}</p> : null}
            <ul>
              {g.itens.map((item) => (
                <li key={item.rota}><LinkItem item={item} acesso={acesso} /></li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <CartaoPlano nivel={acesso.nivel} />
      <Link to={caminho("/suporte")} className={linkMenu}>{t("menu.suporte")}</Link>
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
      <button ref={botao} type="button" aria-expanded={aberto} aria-label={t("menu.conta")} onClick={() => setAberto(!aberto)} className={`inline-flex size-11 items-center justify-center rounded-full bg-superficie font-semibold uppercase ${foco}`}>
        {email.charAt(0) || "?"}
      </button>
      {aberto ? (
        <div className="absolute right-0 z-30 mt-2 w-72 rounded-2xl border border-creme/20 bg-painel p-3">
          <p className="truncate px-3 text-sm">{email}</p>
          <p className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm text-creme/70">
            {t("nivel.rotulo")}: {t(`nivel.${acesso.nivel}`)}
            {acesso.premiado ? <Selo tom="dourado">{t("selo.premiado")}</Selo> : null}
          </p>
          <ul className="border-t border-creme/10 pt-2">
            {AVATAR.map((item) => (
              <li key={item.rota}><LinkItem item={item} acesso={acesso} /></li>
            ))}
            <li><button type="button" onClick={sairDaConta} className={`${linkMenu} w-full text-left`}>{t("menu.sair")}</button></li>
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
    <dialog ref={ref} aria-label={t("menu.mais")} onClose={fechar} onClick={(e) => e.target === e.currentTarget && fechar()} className="m-0 mt-auto w-full max-w-none rounded-t-2xl border border-creme/20 bg-painel p-0 text-creme backdrop:bg-black/60 lg:hidden">
      <div className="p-4">
      <div className="flex items-center justify-between px-3 pb-2">
        <p className="font-semibold">{t("menu.mais")}</p>
        <button type="button" onClick={fechar} aria-label={t("comum.fechar")} className={`inline-flex size-11 items-center justify-center rounded-lg ${foco}`}>
          <Icone nome="fechar" />
        </button>
      </div>
      {/* Clicar num link navega e fecha a folha (o clique sobe até aqui). */}
      <ul onClick={fechar}>
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
  const item = `flex min-h-14 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold text-creme/70 aria-[current=page]:border-t-2 aria-[current=page]:border-destaque aria-[current=page]:text-destaque ${foco}`
  return (
    <>
      <nav aria-label={t("menu.abas")} className="fixed inset-x-0 bottom-0 z-20 flex border-t border-creme/15 bg-fundo lg:hidden">
        {ABAS.map((a) => (
          <NavLink key={a.rota} to={caminho(a.rota)} className={item}>
            <Icone nome={a.icone} className="size-6" />
            {t(a.rotulo)}
          </NavLink>
        ))}
        <button type="button" onClick={() => setMais(true)} className={item}>
          <Icone nome="menu" className="size-6" />
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
export function LayoutMembro() {
  const t = useT()
  const caminho = useCaminho()
  const acesso = useAcesso()
  return (
    <div className="flex min-h-dvh">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:z-40 focus:m-2 focus:rounded-lg focus:bg-creme focus:px-4 focus:py-3 focus:text-fundo">{t("menu.pular")}</a>
      <Sidebar acesso={acesso} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-creme/10 bg-fundo/85 px-4 backdrop-blur-md sm:px-8">
          <Marca to={caminho("/inicio")} className="max-sm:[&>span]:hidden lg:invisible" />
          <div className="flex items-center gap-2">
            <SeletorIdioma />
            <Link to={caminho("/notificacoes")} aria-label={t("menu.notificacoes")} title={t("menu.notificacoes")} className={`inline-flex size-11 items-center justify-center rounded-full hover:bg-creme/10 ${foco}`}>
              <Icone nome="sino" />
            </Link>
            <MenuAvatar acesso={acesso} />
          </div>
        </header>
        <main id="conteudo" tabIndex={-1} className="flex-1 pb-20 outline-none lg:pb-0">
          {acesso.carregando ? <Esqueleto linhas={4} className="mx-auto max-w-3xl px-6 py-16" /> : acesso.erro ? (
            <div className="mx-auto max-w-3xl px-6 py-16"><Erro aoTentar={acesso.recarregar}>{t("acesso.erro")}</Erro></div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
      <BarraAbas acesso={acesso} />
    </div>
  )
}
