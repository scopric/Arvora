import { useId, useState, type ReactNode, type SubmitEvent } from "react"
import { Link, useSearchParams } from "react-router"
import { Aviso } from "../../../componentes/Aviso"
import { Bloqueado } from "../../../componentes/Bloqueado"
import { Botao } from "../../../componentes/Botao"
import { DialogoConfirmar } from "../../../componentes/DialogoConfirmar"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { Selo } from "../../../componentes/Selo"
import { Vazio } from "../../../componentes/Vazio"
import { useIdioma, useT, type Chave } from "../../../i18n"
import { campoApp } from "../../../componentes/campoEstilo"
import { Icone } from "../../../componentes/Icone"
import { focoApp } from "../../../componentes/menuApp"
import { PaginaApp } from "../../../componentes/PaginaApp"
import { temNivel, useAcesso } from "../../../lib/acesso"
import { useAuth } from "../../../lib/sessao"
import { supabase } from "../../../lib/supabase"
import { Avatar, DialogoDenuncia } from "../componentes"
import { nomeDe, ok, quando, useCarga, vitrinesPorId } from "../lib"

const JANELA_EDICAO_MS = 15 * 60_000 // PROVISÓRIO: igual ao banco (editar até 15 min depois de criar)

type Tipo = "posts" | "comentarios"
type Alvo = { tipo: Tipo; id: number }
type Item = { id: number; autor_id: string | null; corpo: string; oculto_em: string | null; editado_em: string | null; criado_em: string; comentarios?: { count: number }[] }

async function salvarTexto({ tipo, id }: Alvo, corpo: string) {
  return tipo === "posts"
    ? supabase.from("posts").update({ corpo }).eq("id", id).select("id")
    : supabase.from("comentarios").update({ corpo }).eq("id", id).select("id")
}
async function apagarTexto({ tipo, id }: Alvo) {
  return tipo === "posts"
    ? supabase.from("posts").delete().eq("id", id).select("id")
    : supabase.from("comentarios").delete().eq("id", id).select("id")
}

// Um post ou comentário: autor, data, "em análise" (oculto pela moderação), editar (15 min), apagar ou denunciar.
function Mensagem({ tipo, item, autor, uid, aoMudar, children, conversa }: { tipo: Tipo; item: Item; autor: string | null; uid: string; aoMudar: () => void | Promise<void>; children?: ReactNode; conversa?: ReactNode }) {
  const t = useT()
  const idioma = useIdioma()
  const [editando, setEditando] = useState(false)
  const [apagando, setApagando] = useState(false)
  const [denunciando, setDenunciando] = useState(false)
  const [erro, setErro] = useState<Chave | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [agora] = useState(() => Date.now())
  const meu = item.autor_id === uid
  const podeEditar = meu && !item.oculto_em && agora - new Date(item.criado_em).getTime() < JANELA_EDICAO_MS
  const alvo = { tipo, id: item.id }
  const quem = `${t("rede.comunidade.postDe")} ${autor ?? t("rede.comunidade.membro")}, ${quando(item.criado_em, idioma)}`

  async function salvar(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    const corpo = String(new FormData(e.currentTarget).get("corpo") ?? "")
    setErro(null)
    setOcupado(true)
    // .select('id'): fora da janela de 15 min o RLS não casa linha e o UPDATE volta vazio (Erros 2.5).
    const { data, error } = await salvarTexto(alvo, corpo)
    if (error || !data || data.length === 0) {
      setOcupado(false)
      return setErro(error ? "rede.comunidade.erroSalvar" : "rede.comunidade.prazoEdicao")
    }
    setEditando(false)
    await aoMudar()
    setOcupado(false)
  }
  async function apagar() {
    setApagando(false)
    setErro(null)
    const { data, error } = await apagarTexto(alvo)
    // Sem erro e sem linha: o RLS barrou (denúncia aberta sobre o texto, ou já oculto pela moderação).
    if (error) return setErro("rede.comunidade.erroApagar")
    if (!data || data.length === 0) return setErro("rede.comunidade.apagarBloqueado")
    aoMudar()
  }

  // Molde Peerlist: avatar 40 à esquerda; nome 16/600 com a hora em cinza embaixo; o texto e as ações alinham com o nome.
  const nome = autor ?? t(item.autor_id ? "rede.comunidade.membro" : "rede.comunidade.exMembro")
  return (
    <article className={`${tipo === "posts" ? "rounded-lg p-5 vidro sm:p-6" : "border-t border-placa pt-4 first:border-t-0 first:pt-0"} ${item.oculto_em ? "opacity-60" : ""}`}>
      <header className="flex items-start gap-3">
        <Avatar nome={autor} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <strong className="text-corpo font-semibold text-creme">{nome}</strong>
            {item.oculto_em ? <Selo tom="alerta">{t("rede.comunidade.emAnalise")}</Selo> : null}
          </p>
          <p className="text-corpo-p text-cinza">
            <time dateTime={item.criado_em}>{quando(item.criado_em, idioma)}</time>
            {item.editado_em ? <span> · {t("rede.comunidade.editado")}</span> : null}
          </p>
        </div>
      </header>
      <div className="sm:pl-13">
        {editando ? (
          <form onSubmit={salvar} className="mt-3 space-y-3">
            <label htmlFor={`ed-${tipo}-${item.id}`} className="sr-only">{t("rede.comunidade.editar")}</label>
            <textarea id={`ed-${tipo}-${item.id}`} name="corpo" defaultValue={item.corpo} rows={3} maxLength={tipo === "posts" ? 5000 : 2000} required className={campoApp} />
            <div className="flex gap-3">
              <Botao type="submit" variante="secundario" ocupado={ocupado} className="sm:w-auto">{t("rede.comunidade.salvar")}</Botao>
              <Botao type="button" variante="contorno" onClick={() => setEditando(false)} className="sm:w-auto">{t("comum.cancelar")}</Botao>
            </div>
          </form>
        ) : (
          <p className="mt-3 text-corpo break-words whitespace-pre-wrap">{item.corpo}</p>
        )}
        {erro ? <div className="mt-3"><Aviso tipo="erro">{t(erro)}</Aviso></div> : null}
        {!editando ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {children ? <div className="mr-auto">{children}</div> : null}
            {podeEditar ? <Botao pequeno onClick={() => setEditando(true)} aria-label={`${t("rede.comunidade.editar")} ${quem}`}>{t("rede.comunidade.editar")}</Botao> : null}
            {meu && !item.oculto_em ? <Botao pequeno variante="perigo" onClick={() => setApagando(true)} aria-label={`${t("rede.comunidade.apagar")} ${quem}`}>{t("rede.comunidade.apagar")}</Botao> : null}
            {!meu && item.autor_id ? <Botao pequeno onClick={() => setDenunciando(true)} aria-label={`${t("rede.comunidade.denunciar")} ${quem}`}>{t("rede.comunidade.denunciar")}</Botao> : null}
          </div>
        ) : null}
        {conversa}
      </div>
      <DialogoConfirmar aberto={apagando} titulo={t("rede.comunidade.apagarTitulo")} texto={t("rede.comunidade.apagarTexto")} confirmar={t("rede.comunidade.apagar")} perigo aoConfirmar={() => void apagar()} aoCancelar={() => setApagando(false)} />
      <DialogoDenuncia alvo={tipo === "posts" ? { post_id: item.id } : { comentario_id: item.id }} aberto={denunciando} aoFechar={() => setDenunciando(false)} />
    </article>
  )
}

// Caixa de texto + Publicar (post novo ou comentário). O rótulo fica para o leitor de tela; o placeholder convida a escrever.
// `primario`: a caixa de post novo é o único botão dourado da tela; a de comentário fica em cinza, dentro do post.
function Caixa({ rotulo, convite, botao, maximo, aoEnviar, primario, autor }: { rotulo: string; convite: string; botao: string; maximo: number; aoEnviar: (corpo: string) => Promise<boolean>; primario?: boolean; autor?: string | null }) {
  const t = useT()
  const [erro, setErro] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const id = useId()
  async function enviar(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const corpo = String(new FormData(form).get("corpo") ?? "").trim()
    if (!corpo) return
    setErro(false)
    setOcupado(true)
    const feito = await aoEnviar(corpo)
    setOcupado(false)
    setErro(!feito)
    if (feito) form.reset()
  }
  // Molde Nextdoor/X: avatar à esquerda e o campo ao lado; Publicar à direita, embaixo.
  return (
    <form onSubmit={enviar} className={primario ? "rounded-lg p-4 vidro sm:p-5" : ""}>
      <div className="flex items-start gap-3">
        {primario ? <Avatar nome={autor ?? null} /> : null}
        <div className="min-w-0 flex-1 space-y-3">
          <label htmlFor={id} className="sr-only">{rotulo}</label>
          <textarea id={id} name="corpo" rows={2} maxLength={maximo} required placeholder={convite} className={campoApp} />
          {erro ? <Aviso tipo="erro">{t("rede.comunidade.erroPublicar")}</Aviso> : null}
          <div className="flex justify-end"><Botao type="submit" variante={primario ? "primario" : "secundario"} ocupado={ocupado} className="sm:w-auto">{botao}</Botao></div>
        </div>
      </div>
    </form>
  )
}

function Comentarios({ postId, uid }: { postId: number; uid: string }) {
  const t = useT()
  const { estado, recarregar } = useCarga(async () => {
    // ponytail: os 100 mais recentes (desc + limite) e inverte para ler do mais antigo; paginar comentários antigos se algum post passar disso.
    const recentes = ok(await supabase.from("comentarios").select("id, autor_id, corpo, oculto_em, editado_em, criado_em").eq("post_id", postId).order("criado_em", { ascending: false }).limit(100))
    const lista = [...recentes].reverse()
    return { lista, autores: await vitrinesPorId(lista.map((c) => c.autor_id)) }
  }, postId)
  if (estado.fase === "carregando") return <Esqueleto linhas={2} />
  if (estado.fase === "erro") return <Erro aoTentar={recarregar}>{t("rede.comunidade.erroComentarios")}</Erro>
  return (
    <div className="space-y-4 border-l-2 border-placa pl-4">
      {estado.dados.lista.map((c) => (
        <Mensagem key={c.id} tipo="comentarios" item={c} autor={estado.dados.autores.get(c.autor_id ?? "")?.nome ?? null} uid={uid} aoMudar={recarregar} />
      ))}
      <Caixa
        rotulo={t("rede.comunidade.comentar")}
        convite={t("rede.comunidade.comentarConvite")}
        botao={t("rede.comunidade.comentarBotao")}
        maximo={2000}
        aoEnviar={async (corpo) => {
          const { error } = await supabase.from("comentarios").insert({ post_id: postId, corpo }).select("id")
          if (!error) recarregar()
          return !error
        }}
      />
    </div>
  )
}

// Post do feed: a conversa abre dentro do cartão, sob o texto (Peerlist), com a contagem no botão (Nextdoor).
function Post({ item, autor, uid, aoMudar }: { item: Item; autor: string | null; uid: string; aoMudar: () => void }) {
  const t = useT()
  const [aberto, setAberto] = useState(false)
  const n = item.comentarios?.[0]?.count ?? 0
  const rotulo = n === 0 ? t("rede.comunidade.comentarBotao") : `${n} ${t(n === 1 ? "rede.comunidade.comentario1" : "rede.comunidade.comentariosN")}`
  return (
    <li>
      <Mensagem tipo="posts" item={item} autor={autor} uid={uid} aoMudar={aoMudar} conversa={aberto ? <div className="mt-4"><Comentarios postId={item.id} uid={uid} /></div> : null}>
        {!item.oculto_em ? (
          <button type="button" aria-expanded={aberto} onClick={() => setAberto(!aberto)} className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-corpo-p font-semibold text-cinza transition-colors pointer-coarse:min-h-11 hover:text-creme aria-expanded:text-creme ${focoApp}`}>
            <Icone nome="balao" className="size-5" />
            {rotulo}
          </button>
        ) : null}
      </Mensagem>
    </li>
  )
}

type EspacoLinha = { id: number; titulo: string; titulo_en: string | null; descricao: string | null; nivel_minimo: string }

function Feed({ espaco, uid }: { espaco: EspacoLinha; uid: string }) {
  const t = useT()
  // ponytail: 50 posts mais recentes, sem "ver mais"; paginar quando o volume pedir.
  // comentarios(count) respeita o RLS: conta só o que a pessoa pode ler.
  const { estado, recarregar } = useCarga(async () => {
    const lista: Item[] = ok(await supabase.from("posts").select("id, autor_id, corpo, oculto_em, editado_em, criado_em, comentarios(count)").eq("espaco_id", espaco.id).order("criado_em", { ascending: false }).limit(50))
    return { lista, autores: await vitrinesPorId([uid, ...lista.map((p) => p.autor_id)]) }
  }, espaco.id)
  const eu = estado.fase === "pronto" ? (estado.dados.autores.get(uid)?.nome ?? null) : null
  return (
    <div className="space-y-4">
      <Caixa
        rotulo={t("rede.comunidade.novoPost")}
        convite={t("rede.comunidade.convite")}
        botao={t("rede.comunidade.publicar")}
        maximo={5000}
        primario
        autor={eu}
        aoEnviar={async (corpo) => {
          const { error } = await supabase.from("posts").insert({ espaco_id: espaco.id, corpo }).select("id")
          if (!error) recarregar()
          return !error
        }}
      />
      {estado.fase === "carregando" ? <Esqueleto linhas={4} /> : null}
      {estado.fase === "erro" ? <Erro aoTentar={recarregar}>{t("rede.comunidade.erroPosts")}</Erro> : null}
      {estado.fase === "pronto" && estado.dados.lista.length === 0 ? <Vazio>{t("rede.comunidade.vazio")}</Vazio> : null}
      {estado.fase === "pronto" && estado.dados.lista.length > 0 ? (
        <ul className="space-y-4">
          {estado.dados.lista.map((p) => (
            <Post key={p.id} item={p} autor={estado.dados.autores.get(p.autor_id ?? "")?.nome ?? null} uid={uid} aoMudar={recarregar} />
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function Regras() {
  const t = useT()
  // PROVISÓRIO: regras de convivência a validar pelo cliente (PRD COM-02)
  return (
    <ul className="list-disc space-y-1 pl-5 text-corpo-p text-cinza">
      <li>{t("rede.comunidade.regra1")}</li>
      <li>{t("rede.comunidade.regra2")}</li>
      <li>{t("rede.comunidade.regra3")}</li>
      <li>{t("rede.comunidade.regra4")}</li>
    </ul>
  )
}

const GRUPO_BLOQUEADO = "grupo"
// Um link por espaço: pílula no celular (chips do Nextdoor), item de menu com barra dourada no desktop (menu do Nextdoor).
const itemEspaco = `relative inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full px-4 text-corpo-p font-semibold whitespace-nowrap text-cinza transition-colors pointer-coarse:min-h-11 hover:text-creme aria-[current=page]:bg-fumaca/70 aria-[current=page]:text-creme lg:flex lg:w-full lg:rounded-lg lg:px-3 lg:hover:bg-fumaca/30 lg:aria-[current=page]:bg-fumaca/50 lg:aria-[current=page]:before:absolute lg:aria-[current=page]:before:inset-y-2 lg:aria-[current=page]:before:left-0 lg:aria-[current=page]:before:w-0.5 lg:aria-[current=page]:before:rounded-full lg:aria-[current=page]:before:bg-dourado ${focoApp}`

export function Comunidade() {
  const t = useT()
  const idioma = useIdioma()
  const acesso = useAcesso()
  const { sessao } = useAuth()
  const [busca] = useSearchParams()
  const uid = sessao?.user.id ?? ""
  const liberado = !acesso.carregando && !acesso.erro && temNivel(acesso.nivel, "clube")
  const { estado, recarregar } = useCarga(
    async () => (liberado ? (ok(await supabase.from("espacos").select("id, titulo, titulo_en, descricao, nivel_minimo").order("ordem")) as EspacoLinha[]) : []),
    `${liberado}-${acesso.nivel}`,
  )

  let corpo
  if (acesso.carregando) corpo = <Esqueleto linhas={4} />
  else if (acesso.erro) corpo = <Erro aoTentar={acesso.recarregar}>{t("acesso.erro")}</Erro>
  else if (!liberado) corpo = <Bloqueado minimo="clube" frase={t("rede.comunidade.bloqueado")} />
  else if (estado.fase === "carregando") corpo = <Esqueleto linhas={4} />
  else if (estado.fase === "erro") corpo = <Erro aoTentar={recarregar}>{t("rede.comunidade.erroEspacos")}</Erro>
  else if (estado.dados.length === 0) corpo = <Vazio>{t("rede.comunidade.semEspacos")}</Vazio>
  else {
    const espacos = estado.dados
    // O Clube não lê o espaço do Grupo (RLS): o item bloqueado é fixo, só para mostrar o que o upgrade traz.
    const comCadeado = acesso.nivel === "clube" && !espacos.some((e) => e.nivel_minimo === "grupo")
    const pedido = busca.get("espaco")
    const bloqueado = comCadeado && pedido === GRUPO_BLOQUEADO
    const atual = espacos.find((e) => String(e.id) === pedido) ?? espacos[0]
    const itens = [
      ...espacos.map((e) => ({ chave: String(e.id), rotulo: nomeDe({ nome: e.titulo, nome_en: e.titulo_en }, idioma), ativo: !bloqueado && e.id === atual.id, cadeado: false })),
      ...(comCadeado ? [{ chave: GRUPO_BLOQUEADO, rotulo: t("rede.comunidade.espacoGrupo"), ativo: bloqueado, cadeado: true }] : []),
    ]
    const titulo = bloqueado ? t("rede.comunidade.espacoGrupo") : nomeDe({ nome: atual.titulo, nome_en: atual.titulo_en }, idioma)
    // Molde Nextdoor escuro: espaços à esquerda (chips no celular), feed ao centro, sobre o espaço e regras à direita.
    corpo = (
      <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)_17rem] lg:items-start lg:gap-8">
        <nav aria-label={t("rede.comunidade.espacos")} className="lg:sticky lg:top-24">
          <h2 className="mb-2 hidden px-3 text-corpo-p font-semibold text-cinza lg:block">{t("rede.comunidade.espacos")}</h2>
          <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 lg:flex-col lg:gap-1 lg:overflow-visible">
            {itens.map((i) => (
              <li key={i.chave}>
                <Link to={`?espaco=${i.chave}`} replace preventScrollReset aria-current={i.ativo ? "page" : undefined} className={itemEspaco}>
                  <Icone nome={i.cadeado ? "cadeado" : "balao"} className="size-4 shrink-0" />
                  {i.rotulo}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {/* No celular, sobre e regras vêm antes do feed (no fim, ficariam atrás de todos os posts). */}
        <section aria-labelledby="espaco-atual" className="order-last min-w-0 lg:order-none">
          <h2 id="espaco-atual" className="mb-4 text-subtitulo font-semibold">{titulo}</h2>
          {bloqueado ? <Bloqueado frase={t("rede.comunidade.bloqueadoGrupo")} /> : <Feed key={atual.id} espaco={atual} uid={uid} />}
        </section>
        <aside aria-label={t("rede.comunidade.sobre")} className="space-y-4 lg:sticky lg:top-24">
          {!bloqueado && atual.descricao ? (
            <div className="rounded-lg p-5 vidro">
              <h2 className="text-corpo font-semibold">{t("rede.comunidade.sobreEspaco")}</h2>
              <p className="mt-2 text-corpo-p text-cinza">{atual.descricao}</p>
            </div>
          ) : null}
          <details className="rounded-lg px-5 py-1 vidro lg:hidden">
            <summary className={`min-h-11 cursor-pointer rounded-sm py-2.5 text-corpo-p font-semibold text-cinza hover:text-creme ${focoApp}`}>{t("rede.comunidade.regrasTitulo")}</summary>
            <div className="mb-4"><Regras /></div>
          </details>
          <div className="hidden rounded-lg p-5 vidro lg:block">
            <h2 className="mb-3 text-corpo font-semibold">{t("rede.comunidade.regrasTitulo")}</h2>
            <Regras />
          </div>
        </aside>
      </div>
    )
  }

  return <PaginaApp chave="rede.comunidade.titulo">{corpo}</PaginaApp>
}
