import { useState, type SubmitEvent } from "react"
import { Abas } from "../../../componentes/Abas"
import { Aviso } from "../../../componentes/Aviso"
import { Bloqueado } from "../../../componentes/Bloqueado"
import { Botao } from "../../../componentes/Botao"
import { DialogoConfirmar } from "../../../componentes/DialogoConfirmar"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { Selo } from "../../../componentes/Selo"
import { Vazio } from "../../../componentes/Vazio"
import { useIdioma, useT, useTitulo, type Chave } from "../../../i18n"
import { temNivel, useAcesso } from "../../../lib/acesso"
import { useAuth } from "../../../lib/sessao"
import { supabase } from "../../../lib/supabase"
import { campoTexto, DialogoDenuncia } from "../componentes"
import { nomeDe, ok, quando, useCarga, vitrinesPorId } from "../lib"

const JANELA_EDICAO_MS = 15 * 60_000 // PROVISÓRIO: igual ao banco (editar até 15 min depois de criar)

type Tipo = "posts" | "comentarios"
type Alvo = { tipo: Tipo; id: number }
type Item = { id: number; autor_id: string | null; corpo: string; oculto_em: string | null; editado_em: string | null; criado_em: string }

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
function Mensagem({ tipo, item, autor, uid, aoMudar }: { tipo: Tipo; item: Item; autor: string | null; uid: string; aoMudar: () => void }) {
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

  async function salvar(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    const corpo = String(new FormData(e.currentTarget).get("corpo") ?? "")
    setErro(null)
    setOcupado(true)
    // .select('id'): fora da janela de 15 min o RLS não casa linha e o UPDATE volta vazio (Erros 2.5).
    const { data, error } = await salvarTexto(alvo, corpo)
    setOcupado(false)
    if (error || !data || data.length === 0) return setErro(error ? "rede.comunidade.erroSalvar" : "rede.comunidade.prazoEdicao")
    setEditando(false)
    aoMudar()
  }
  async function apagar() {
    setApagando(false)
    setErro(null)
    const { data, error } = await apagarTexto(alvo)
    if (error || !data || data.length === 0) return setErro("rede.comunidade.erroApagar")
    aoMudar()
  }

  return (
    <article className={`rounded-xl border border-current/15 p-4 ${item.oculto_em ? "opacity-60" : ""}`}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <strong>{autor ?? t(item.autor_id ? "rede.comunidade.membro" : "rede.comunidade.exMembro")}</strong>
        <time dateTime={item.criado_em} className="opacity-60">{quando(item.criado_em, idioma)}</time>
        {item.editado_em ? <span className="opacity-60">{t("rede.comunidade.editado")}</span> : null}
        {item.oculto_em ? <Selo tom="alerta">{t("rede.comunidade.emAnalise")}</Selo> : null}
      </header>
      {editando ? (
        <form onSubmit={salvar} className="mt-3 space-y-3">
          <label htmlFor={`ed-${tipo}-${item.id}`} className="sr-only">{t("rede.comunidade.editar")}</label>
          <textarea id={`ed-${tipo}-${item.id}`} name="corpo" defaultValue={item.corpo} rows={3} maxLength={tipo === "posts" ? 5000 : 2000} required className={campoTexto} />
          <div className="flex gap-3">
            <Botao type="submit" ocupado={ocupado} className="sm:w-auto">{t("rede.comunidade.salvar")}</Botao>
            <Botao type="button" variante="contorno" onClick={() => setEditando(false)} className="sm:w-auto">{t("comum.cancelar")}</Botao>
          </div>
        </form>
      ) : (
        <p className="mt-3 whitespace-pre-wrap break-words">{item.corpo}</p>
      )}
      {erro ? <div className="mt-3"><Aviso tipo="erro">{t(erro)}</Aviso></div> : null}
      {!editando ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {podeEditar ? <Botao variante="contorno" onClick={() => setEditando(true)} className="min-h-11 w-auto px-4 text-sm">{t("rede.comunidade.editar")}</Botao> : null}
          {meu && !item.oculto_em ? <Botao variante="contorno" onClick={() => setApagando(true)} className="min-h-11 w-auto px-4 text-sm">{t("rede.comunidade.apagar")}</Botao> : null}
          {!meu && item.autor_id ? <Botao variante="contorno" onClick={() => setDenunciando(true)} className="min-h-11 w-auto px-4 text-sm">{t("rede.comunidade.denunciar")}</Botao> : null}
        </div>
      ) : null}
      <DialogoConfirmar aberto={apagando} titulo={t("rede.comunidade.apagarTitulo")} texto={t("rede.comunidade.apagarTexto")} confirmar={t("rede.comunidade.apagar")} perigo aoConfirmar={() => void apagar()} aoCancelar={() => setApagando(false)} />
      <DialogoDenuncia alvo={tipo === "posts" ? { post_id: item.id } : { comentario_id: item.id }} aberto={denunciando} aoFechar={() => setDenunciando(false)} />
    </article>
  )
}

// Caixa de texto + Publicar (post novo ou comentário).
function Caixa({ rotulo, botao, maximo, aoEnviar }: { rotulo: string; botao: string; maximo: number; aoEnviar: (corpo: string) => Promise<boolean> }) {
  const t = useT()
  const [erro, setErro] = useState(false)
  const [ocupado, setOcupado] = useState(false)
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
  return (
    <form onSubmit={enviar} className="space-y-3">
      <label htmlFor={`cx-${rotulo}`} className="block text-sm font-semibold">{rotulo}</label>
      <textarea id={`cx-${rotulo}`} name="corpo" rows={3} maxLength={maximo} required className={campoTexto} />
      {erro ? <Aviso tipo="erro">{t("rede.comunidade.erroPublicar")}</Aviso> : null}
      <Botao type="submit" ocupado={ocupado} className="sm:w-auto">{botao}</Botao>
    </form>
  )
}

function Comentarios({ postId, uid }: { postId: number; uid: string }) {
  const t = useT()
  const { estado, recarregar } = useCarga(async () => {
    const lista = ok(await supabase.from("comentarios").select("id, autor_id, corpo, oculto_em, editado_em, criado_em").eq("post_id", postId).order("criado_em").limit(100))
    return { lista, autores: await vitrinesPorId(lista.map((c) => c.autor_id)) }
  }, postId)
  if (estado.fase === "carregando") return <Esqueleto linhas={2} />
  if (estado.fase === "erro") return <Erro aoTentar={recarregar}>{t("rede.comunidade.erroComentarios")}</Erro>
  return (
    <div className="space-y-3">
      {estado.dados.lista.map((c) => (
        <Mensagem key={c.id} tipo="comentarios" item={c} autor={estado.dados.autores.get(c.autor_id ?? "")?.nome ?? null} uid={uid} aoMudar={recarregar} />
      ))}
      <Caixa
        rotulo={t("rede.comunidade.comentar")}
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

function Post({ item, autor, uid, aoMudar }: { item: Item; autor: string | null; uid: string; aoMudar: () => void }) {
  const t = useT()
  const [aberto, setAberto] = useState(false)
  return (
    <li className="space-y-3">
      <Mensagem tipo="posts" item={item} autor={autor} uid={uid} aoMudar={aoMudar} />
      {!item.oculto_em ? (
        <div className="pl-4 sm:pl-8">
          <Botao variante="contorno" aria-expanded={aberto} onClick={() => setAberto(!aberto)} className="min-h-11 w-auto px-4 text-sm">
            {t(aberto ? "rede.comunidade.fecharComentarios" : "rede.comunidade.verComentarios")}
          </Botao>
          {aberto ? <div className="mt-3"><Comentarios postId={item.id} uid={uid} /></div> : null}
        </div>
      ) : null}
    </li>
  )
}

function Espaco({ espacoId, uid }: { espacoId: number; uid: string }) {
  const t = useT()
  // ponytail: 50 posts mais recentes, sem "ver mais"; paginar quando o volume pedir.
  const { estado, recarregar } = useCarga(async () => {
    const lista = ok(await supabase.from("posts").select("id, autor_id, corpo, oculto_em, editado_em, criado_em").eq("espaco_id", espacoId).order("criado_em", { ascending: false }).limit(50))
    return { lista, autores: await vitrinesPorId(lista.map((p) => p.autor_id)) }
  }, espacoId)
  return (
    <div className="space-y-6">
      <Caixa
        rotulo={t("rede.comunidade.novoPost")}
        botao={t("rede.comunidade.publicar")}
        maximo={5000}
        aoEnviar={async (corpo) => {
          const { error } = await supabase.from("posts").insert({ espaco_id: espacoId, corpo }).select("id")
          if (!error) recarregar()
          return !error
        }}
      />
      {estado.fase === "carregando" ? <Esqueleto linhas={4} /> : null}
      {estado.fase === "erro" ? <Erro aoTentar={recarregar}>{t("rede.comunidade.erroPosts")}</Erro> : null}
      {estado.fase === "pronto" && estado.dados.lista.length === 0 ? <Vazio>{t("rede.comunidade.vazio")}</Vazio> : null}
      {estado.fase === "pronto" && estado.dados.lista.length > 0 ? (
        <ul className="space-y-6">
          {estado.dados.lista.map((p) => (
            <Post key={p.id} item={p} autor={estado.dados.autores.get(p.autor_id ?? "")?.nome ?? null} uid={uid} aoMudar={recarregar} />
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function Comunidade() {
  const t = useT()
  const idioma = useIdioma()
  useTitulo("rede.comunidade.titulo")
  const acesso = useAcesso()
  const { sessao } = useAuth()
  const uid = sessao?.user.id ?? ""
  const liberado = !acesso.carregando && !acesso.erro && temNivel(acesso.nivel, "clube")
  const { estado, recarregar } = useCarga(
    async () => (liberado ? ok(await supabase.from("espacos").select("id, titulo, titulo_en, descricao, nivel_minimo").order("ordem")) : []),
    `${liberado}-${acesso.nivel}`,
  )

  let corpo
  if (acesso.carregando) corpo = <Esqueleto linhas={4} />
  else if (acesso.erro) corpo = <Erro aoTentar={acesso.recarregar}>{t("acesso.erro")}</Erro>
  else if (!liberado) corpo = <Bloqueado minimo="clube" frase={t("rede.comunidade.bloqueado")} />
  else if (estado.fase === "carregando") corpo = <Esqueleto linhas={4} />
  else if (estado.fase === "erro") corpo = <Erro aoTentar={recarregar}>{t("rede.comunidade.erroEspacos")}</Erro>
  else {
    const abas = estado.dados.map((e) => ({ chave: String(e.id), rotulo: nomeDe({ nome: e.titulo, nome_en: e.titulo_en }, idioma), conteudo: <Espaco espacoId={e.id} uid={uid} /> }))
    // O Clube não lê o espaço do Grupo (RLS): a aba bloqueada é fixa, só para mostrar o que o upgrade traz.
    if (acesso.nivel === "clube" && !estado.dados.some((e) => e.nivel_minimo === "grupo"))
      abas.push({ chave: "grupo-bloqueado", rotulo: t("rede.comunidade.espacoGrupo"), conteudo: <Bloqueado frase={t("rede.comunidade.bloqueadoGrupo")} /> })
    corpo = abas.length === 0 ? <Vazio>{t("rede.comunidade.semEspacos")}</Vazio> : <Abas abas={abas} rotulo={t("rede.comunidade.espacos")} />
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
      <h1 className="font-titulo text-4xl font-medium">{t("rede.comunidade.titulo")}</h1>
      <details className="mt-4 rounded-xl border border-current/15 px-4 py-3">
        <summary className="min-h-11 cursor-pointer py-2 font-semibold">{t("rede.comunidade.regrasTitulo")}</summary>
        {/* PROVISÓRIO: regras de convivência a validar pelo cliente (PRD COM-02) */}
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm opacity-85">
          <li>{t("rede.comunidade.regra1")}</li>
          <li>{t("rede.comunidade.regra2")}</li>
          <li>{t("rede.comunidade.regra3")}</li>
          <li>{t("rede.comunidade.regra4")}</li>
        </ul>
      </details>
      <div className="mt-8">{corpo}</div>
    </div>
  )
}
