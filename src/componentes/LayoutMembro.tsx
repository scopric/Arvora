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
import { focoApp, itemTrilhoApp, linkListaApp, pilulaNavApp } from "./menuApp"
import { ABAS, AREAS, AVATAR, MAIS, areaDe, type Item } from "./navegacao"

// Casca do membro (Decisão 70): estrutura do app do MasterClass (telas 5ef9a9fb e 93622e8c) com a camada de vidro
// sobre o palco verde aprovada em 03/11: trilho de ícones de vidro à esquerda com a marca e as quatro áreas
// (Início · Aprender · Rede · Awards), barra de vidro flutuante com as seções da área em pílulas, idioma, sino e
// avatar; o conteúdo direto sobre o palco. Sem busca global no MVP (PRD §17.3.2, LEG-04 é P1): o centro da barra
// fica reservado. No celular, tab bar de 5 itens e folha "Mais"; as seções descem para uma segunda linha da barra.
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
    <NavLink to={caminho(item.rota)} end={item.rota === "/configuracoes"} title={dica} className={classe}>
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

// Trilho de ícones (desktop): sidebar compacta de vidro com a marca e as quatro áreas; o rótulo vai no title e para o
// leitor de tela. O ativo é por prefixo da área, não por rota exata: /academy/vendas acende "Aprender".
function Trilho({ caminhoAtual }: { caminhoAtual: string }) {
  const t = useT()
  const caminho = useCaminho()
  const ativa = areaDe(caminhoAtual)
  return (
    <nav aria-label={t("menu.membro")} className="app fixed inset-y-3 left-3 z-20 hidden w-16 flex-col items-center gap-1 rounded-xl py-3 vidro-fundo lg:flex">
      <Marca to={caminho("/inicio")} className="mb-2 justify-center [&>span]:sr-only" />
      {AREAS.map((a) => (
        <Link key={a.rota} to={caminho(a.rota)} title={t(a.rotulo)} aria-current={ativa?.rota === a.rota ? "page" : undefined} className={itemTrilhoApp}>
          <Icone nome={a.icone} className="size-5" />
          <span className="sr-only">{t(a.rotulo)}</span>
        </Link>
      ))}
    </nav>
  )
}

// Seções da área ativa em pílulas segmentadas, com os cadeados do PRD §17.3.5. No celular vai para a 2ª linha da barra.
function Secoes({ caminhoAtual, acesso }: { caminhoAtual: string; acesso: Acesso }) {
  const t = useT()
  const area = areaDe(caminhoAtual)
  if (!area?.secoes || !area.itens.length) return null
  return (
    <nav aria-label={t(area.secoes)} className="flex gap-1 overflow-x-auto rounded-full bg-breu/40 p-1 max-lg:order-last max-lg:basis-full">
      {area.itens.map((item) => (
        <LinkItem key={item.rota} item={item} acesso={acesso} classe={pilulaNavApp} />
      ))}
    </nav>
  )
}

// Cartão do plano (gatilho de upgrade do PRD §6.2): saiu da sidebar e mora no popover do avatar.
// Para o Grupo é só informação (o item "Assinatura" logo abaixo já leva à cobrança); Clube e sem plano levam aos planos.
function CartaoPlano({ nivel }: { nivel: Acesso["nivel"] }) {
  const t = useT()
  const caminho = useCaminho()
  const classe = "flex min-h-11 items-center rounded-lg bg-ardosia px-3 text-corpo-p text-creme"
  if (nivel === "grupo") return <p className={classe}>{t("menu.cartao.grupo")}</p>
  return (
    <Link to={caminho("/planos")} className={`${classe} transition-colors hover:bg-fumaca/50 ${foco}`}>
      {t(nivel === "clube" ? "menu.cartao.clube" : "menu.cartao.sem")}
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
        <div className="absolute right-0 z-30 mt-2 w-72 rounded-lg p-2 vidro">
          <p className="truncate px-3 pt-1.5 text-corpo-p text-creme">{email}</p>
          <p className="flex flex-wrap items-center gap-2 px-3 pt-1 pb-2 text-corpo-p text-cinza">
            {t("nivel.rotulo")}: {t(`nivel.${acesso.nivel}`)}
            {acesso.premiado ? <Selo tom="dourado">{t("selo.premiado")}</Selo> : null}
          </p>
          {acesso.carregando || acesso.erro ? null : <CartaoPlano nivel={acesso.nivel} />}
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
    <dialog ref={ref} aria-label={t("menu.mais")} onClose={fechar} onClick={(e) => e.target === e.currentTarget && fechar()} className="app m-0 mt-auto w-full max-w-none rounded-t-xl p-0 text-creme vidro backdrop:bg-breu/70 backdrop:backdrop-blur-sm lg:hidden">
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
      <nav aria-label={t("menu.abas")} className="app fixed inset-x-0 bottom-0 z-20 flex vidro-fundo lg:hidden">
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
      <div className={`flex min-h-dvh flex-col text-creme lg:pl-22 ${conteudoPublico ? "bg-fundo" : "app"}`}>
        <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:z-40 focus:m-2 focus:rounded-lg focus:bg-creme focus:px-4 focus:py-3 focus:text-breu">{t("menu.pular")}</a>
        <Trilho caminhoAtual={caminhoAtual} />
        <header className="app sticky top-0 z-20 px-4 pt-3 lg:px-6">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl px-3 py-2 vidro-fundo sm:px-4 lg:min-h-16">
            <Marca to={caminho("/inicio")} className="[&>span]:hidden lg:hidden" />
            <Secoes caminhoAtual={caminhoAtual} acesso={acesso} />
            {/* Centro reservado para a busca global (LEG-04, P1). */}
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <SeletorIdioma />
              <Link to={caminho("/notificacoes")} aria-label={t("menu.notificacoes")} title={t("menu.notificacoes")} className={`inline-flex size-10 items-center justify-center rounded-full text-cinza transition-colors pointer-coarse:size-11 hover:bg-fumaca/40 hover:text-creme ${foco}`}>
                <Icone nome="sino" className="size-5" />
              </Link>
              <MenuAvatar acesso={acesso} />
            </div>
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
        <BarraAbas acesso={acesso} caminhoAtual={caminhoAtual} />
      </div>
    </EscopoApp>
  )
}
