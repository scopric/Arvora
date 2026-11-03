import { useEffect, useRef, useState } from "react"
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router"
import { useCaminho, useT } from "../i18n"
import { linkSite } from "../lib/enderecos"
import { temNivel, useAcesso, type Acesso } from "../lib/acesso"
import { sair, useAuth } from "../lib/sessao"
import { Erro } from "./Erro"
import { EscopoApp } from "./escopo"
import { Esqueleto } from "./Esqueleto"
import { Icone } from "./Icone"
import { Marca } from "./Marca"
import { SeletorIdioma } from "./SeletorIdioma"
import { Selo } from "./Selo"
import { abaApp, focoApp, linkListaApp, linkTopoApp } from "./menuApp"
import { ABAS, AREAS, AVATAR, MAIS, areaDe, type Item } from "./navegacao"

// Casca do membro no molde do app do MasterClass (Decisão 70; telas-molde 5ef9a9fb e 93622e8c no cofre): barra
// superior em ardósia com a marca, os links de área (Início · Aprender · Rede · Awards), idioma, sino e avatar; as
// seções da área em abas sublinhadas logo abaixo; o conteúdo direto sobre o breu, sem painel. Sem busca global no
// MVP (PRD §17.3.2, LEG-04 é P1): o centro da barra fica reservado. No celular, tab bar de 5 itens e folha "Mais".
const foco = focoApp

// Item bloqueado por nível continua clicável (leva à página com a prévia, PRD §17.1); o leitor de tela ouve o motivo.
function LinkItem({ item, acesso, classe }: { item: Item; acesso: Acesso; classe: string }) {
  const t = useT()
  const caminho = useCaminho()
  if (item.soPremiado && !acesso.premiado) return null
  const pronto = !acesso.carregando && !acesso.erro
  const bloqueado = pronto && !!item.minimo && !temNivel(acesso.nivel, item.minimo)
  const dica = bloqueado ? t(item.minimo === "grupo" ? "menu.bloqueadoGrupo" : "menu.bloqueadoClube") : undefined
  return (
    <NavLink to={caminho(item.rota)} title={dica} className={classe}>
      <Icone nome={item.icone} className="size-4 shrink-0" />
      <span className="truncate">{t(item.rotulo)}</span>
      {bloqueado ? (
        <>
          <Icone nome="cadeado" className="size-3.5 shrink-0 text-cinza" />
          <span className="sr-only">{t(item.minimo === "grupo" ? "bloqueado.rotulo" : "bloqueado.rotuloClube")}</span>
        </>
      ) : null}
    </NavLink>
  )
}

// Links de área (desktop). O ativo é por prefixo da área, não por rota exata: /academy/vendas acende "Aprender".
function LinksDeArea({ caminhoAtual }: { caminhoAtual: string }) {
  const t = useT()
  const caminho = useCaminho()
  const ativa = areaDe(caminhoAtual)
  return (
    <nav aria-label={t("menu.membro")} className="hidden items-center gap-1 lg:flex">
      {AREAS.map((a) => (
        <Link key={a.rota} to={caminho(a.rota)} aria-current={ativa?.rota === a.rota ? "page" : undefined} className={linkTopoApp}>
          {t(a.rotulo)}
        </Link>
      ))}
    </nav>
  )
}

// Seções da área ativa em abas sublinhadas (All Lessons / My Notes do MasterClass), com os cadeados do PRD §17.3.5.
function Secoes({ caminhoAtual, acesso }: { caminhoAtual: string; acesso: Acesso }) {
  const t = useT()
  const area = areaDe(caminhoAtual)
  if (!area?.secoes || !area.itens.length) return null
  return (
    <nav aria-label={t(area.secoes)} className="flex gap-6 overflow-x-auto px-4 sm:px-6">
      {area.itens.map((item) => (
        <LinkItem key={item.rota} item={item} acesso={acesso} classe={`${abaApp} gap-2`} />
      ))}
    </nav>
  )
}

// Cartão do plano (gatilho de upgrade do PRD §6.2): saiu da sidebar e mora no popover do avatar.
function CartaoPlano({ nivel }: { nivel: Acesso["nivel"] }) {
  const t = useT()
  const caminho = useCaminho()
  const grupo = nivel === "grupo"
  return (
    <Link to={caminho(grupo ? "/configuracoes/assinatura" : "/planos")} className={`block rounded-lg bg-ardosia px-3 py-2.5 text-corpo-p text-creme transition-colors hover:bg-fumaca/50 ${foco}`}>
      {t(grupo ? "menu.cartao.grupo" : nivel === "clube" ? "menu.cartao.clube" : "menu.cartao.sem")}
    </Link>
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
    // No app, "/" levaria ao Início e, sem sessão, ao login: volta à home do site (Decisão 66).
    const home = linkSite(caminho("/"))
    if (home.startsWith("/")) navegar(home, { replace: true })
    else window.location.assign(home)
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
      <button ref={botao} type="button" aria-expanded={aberto} aria-label={t("menu.conta")} onClick={() => setAberto(!aberto)} className={`inline-flex size-10 items-center justify-center rounded-full bg-fumaca text-corpo-p font-semibold text-creme uppercase pointer-coarse:size-11 ${foco}`}>
        {email.charAt(0) || "?"}
      </button>
      {aberto ? (
        <div className="absolute right-0 z-30 mt-2 w-72 rounded-lg bg-placa p-2 shadow-borda-placa">
          <p className="truncate px-3 pt-1.5 text-corpo-p text-creme">{email}</p>
          <p className="flex flex-wrap items-center gap-2 px-3 pt-1 pb-2 text-corpo-p text-cinza">
            {t("nivel.rotulo")}: {t(`nivel.${acesso.nivel}`)}
            {acesso.premiado ? <Selo tom="dourado">{t("selo.premiado")}</Selo> : null}
          </p>
          <CartaoPlano nivel={acesso.nivel} />
          <ul className="mt-2 space-y-0.5 border-t border-fumaca pt-2">
            {AVATAR.map((item) => (
              <li key={item.rota}><LinkItem item={item} acesso={acesso} classe={linkListaApp} /></li>
            ))}
            <li>
              <button type="button" onClick={sairDaConta} className={`${linkListaApp} w-full text-left`}>
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
    <dialog ref={ref} aria-label={t("menu.mais")} onClose={fechar} onClick={(e) => e.target === e.currentTarget && fechar()} className="app m-0 mt-auto w-full max-w-none rounded-t-xl bg-ardosia p-0 text-creme backdrop:bg-breu/80 lg:hidden">
      <div className="p-3">
        <div className="flex items-center justify-between px-3 pb-2">
          <p className="text-corpo font-semibold">{t("menu.mais")}</p>
          <button type="button" onClick={fechar} aria-label={t("comum.fechar")} className={`inline-flex size-11 items-center justify-center rounded-lg text-cinza hover:text-creme ${foco}`}>
            <Icone nome="fechar" className="size-5" />
          </button>
        </div>
        {/* Clicar num link navega e fecha a folha (o clique sobe até aqui). */}
        <ul onClick={fechar} className="space-y-0.5 [&_a]:min-h-11 [&_a]:text-corpo">
          {MAIS.map((item) => (
            <li key={item.rota}><LinkItem item={item} acesso={acesso} classe={linkListaApp} /></li>
          ))}
        </ul>
      </div>
    </dialog>
  )
}

function BarraAbas({ acesso, caminhoAtual }: { acesso: Acesso; caminhoAtual: string }) {
  const t = useT()
  const caminho = useCaminho()
  const ativa = areaDe(caminhoAtual)
  const [mais, setMais] = useState(false)
  const item = `relative flex min-h-14 min-w-11 flex-1 flex-col items-center justify-center gap-1 text-corpo-p font-semibold text-cinza aria-[current=page]:text-dourado aria-[current=page]:before:absolute aria-[current=page]:before:inset-x-5 aria-[current=page]:before:top-0 aria-[current=page]:before:h-0.5 aria-[current=page]:before:rounded-full aria-[current=page]:before:bg-dourado ${foco}`
  return (
    <>
      <nav aria-label={t("menu.abas")} className="app fixed inset-x-0 bottom-0 z-20 flex border-t border-placa bg-carvao lg:hidden">
        {ABAS.map((a) => (
          <Link key={a.rota} to={caminho(a.rota)} aria-current={ativa?.rota === a.rota ? "page" : undefined} className={item}>
            <Icone nome={a.icone} className="size-5" />
            {t(a.rotulo)}
          </Link>
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

// Layout da área do membro (PRD §17.3, com a Decisão 70): barra superior no desktop, tab bar de 5 itens no celular,
// sino e avatar no topo. A proteção por login fica em App.tsx (RotaProtegida acima deste layout). A tela de dentro
// não renderiza <main>. Carregando/erro do acesso aparecem aqui; quando chega a tela, o nível já é conhecido.
// `conteudoPublico`: páginas públicas abertas com sessão (planos, biblioteca…) ficam com o visual público dentro
// da casca (Decisão 55): o escopo do app vale só para a barra, as seções e a tab bar.
export function LayoutMembro({ conteudoPublico = false }: { conteudoPublico?: boolean }) {
  const t = useT()
  const caminho = useCaminho()
  const acesso = useAcesso()
  const caminhoAtual = useLocation().pathname.replace(/^\/[^/]*/, "") || "/"
  return (
    <EscopoApp value>
      <div className={`flex min-h-dvh flex-col text-creme ${conteudoPublico ? "bg-fundo" : "app bg-breu"}`}>
        <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:z-40 focus:m-2 focus:rounded-lg focus:bg-creme focus:px-4 focus:py-3 focus:text-breu">{t("menu.pular")}</a>
        <header className="app sticky top-0 z-20 bg-ardosia">
          <div className="flex h-16 items-center gap-4 px-4 sm:px-6 lg:h-20 lg:gap-8">
            <Marca to={caminho("/inicio")} className="max-sm:[&>span]:hidden" />
            {/* Centro reservado para a busca global (LEG-04, P1). */}
            <div className="flex-1" />
            <LinksDeArea caminhoAtual={caminhoAtual} />
            <div className="flex items-center gap-2">
              <SeletorIdioma />
              <Link to={caminho("/notificacoes")} aria-label={t("menu.notificacoes")} title={t("menu.notificacoes")} className={`inline-flex size-10 items-center justify-center rounded-full text-cinza transition-colors pointer-coarse:size-11 hover:bg-placa hover:text-creme ${foco}`}>
                <Icone nome="sino" className="size-5" />
              </Link>
              <MenuAvatar acesso={acesso} />
            </div>
          </div>
          <Secoes caminhoAtual={caminhoAtual} acesso={acesso} />
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
        <BarraAbas acesso={acesso} caminhoAtual={caminhoAtual} />
      </div>
    </EscopoApp>
  )
}
