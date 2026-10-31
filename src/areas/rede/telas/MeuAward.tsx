import { useState, type SubmitEvent } from "react"
import { Link } from "react-router"
import { Aviso } from "../../../componentes/Aviso"
import { Botao } from "../../../componentes/Botao"
import { Campo } from "../../../componentes/Campo"
import { Cartao } from "../../../componentes/Cartao"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { Selo } from "../../../componentes/Selo"
import { Vazio } from "../../../componentes/Vazio"
import { useCaminho, useIdioma, useT, useTitulo, type Chave } from "../../../i18n"
import { useAcesso } from "../../../lib/acesso"
import { useAuth } from "../../../lib/sessao"
import { supabase } from "../../../lib/supabase"
import { campoTexto } from "../componentes"
import { ok, quando, useCarga } from "../lib"

type Pendente = { alteracao_pendente: { historia?: string; materia_url?: string; foto_path?: string; redes?: unknown } | null; alteracao_em: string | null }

const COLUNAS = "id, edicao_id, categoria_id, nome, foto_path, historia, video_entrevista_id, video_premiacao_id, materia_url, publicado_em"

function Premio({ p, edicao, categoria, pendente, aoMudar }: {
  p: { id: number; nome: string; foto_path: string | null; historia: string | null; video_entrevista_id: string | null; video_premiacao_id: string | null; materia_url: string | null; publicado_em: string | null }
  edicao: string
  categoria: string
  pendente: Pendente
  aoMudar: () => void
}) {
  const t = useT()
  const idioma = useIdioma()
  const [editando, setEditando] = useState(false)
  const [erro, setErro] = useState<Chave | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const foto = p.foto_path ? supabase.storage.from("imagens").getPublicUrl(p.foto_path).data.publicUrl : null
  const pend = pendente.alteracao_pendente

  async function pedir(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const historia = String(f.get("historia") ?? "").trim()
    const materia = String(f.get("materia_url") ?? "").trim()
    // Só vai o que mudou de verdade; história e matéria não são apagadas por aqui (a RPC exige texto / https).
    const campos: Record<string, string> = {}
    if (historia && historia !== (p.historia ?? "")) campos.historia = historia
    if (materia && materia !== (p.materia_url ?? "")) campos.materia_url = materia
    if (Object.keys(campos).length === 0) return setErro("rede.meuAward.nadaMudou")
    if (campos.materia_url && !campos.materia_url.startsWith("https://")) return setErro("rede.meuAward.erroUrl")
    setErro(null)
    setOcupado(true)
    const { error } = await supabase.rpc("pedir_alteracao_premiado", { premiado: p.id, campos })
    setOcupado(false)
    if (error) return setErro("rede.meuAward.erroPedir")
    setEditando(false)
    setEnviado(true)
    aoMudar()
  }

  return (
    <div className="space-y-6">
      <section aria-labelledby={`pv-${p.id}`}>
        <h2 id={`pv-${p.id}`} className="font-mono text-xs font-semibold tracking-[0.2em] text-dourado uppercase">{t("rede.meuAward.previa")}</h2>
        <Cartao className="mt-3 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Selo tom="dourado">{t("selo.premiado")}</Selo>
            <Selo tom={p.publicado_em ? "destaque" : "neutro"}>{t(p.publicado_em ? "rede.meuAward.publicado" : "rede.meuAward.naoPublicado")}</Selo>
          </div>
          {foto ? <img src={foto} alt={`${t("rede.meuAward.fotoDe")} ${p.nome}`} className="max-h-72 rounded-xl object-cover" /> : <p className="text-sm opacity-70">{t("rede.meuAward.semFoto")}</p>}
          <div>
            <h3 className="font-titulo text-3xl font-medium">{p.nome}</h3>
            <p className="text-dourado">{categoria} · {edicao}</p>
          </div>
          {p.historia ? <p className="whitespace-pre-wrap">{p.historia}</p> : <p className="text-sm opacity-70">{t("rede.meuAward.semHistoria")}</p>}
          <dl className="grid gap-2 text-sm sm:grid-cols-3">
            <div><dt className="font-semibold">{t("rede.meuAward.videoEntrevista")}</dt><dd className="opacity-80">{t(p.video_entrevista_id ? "rede.meuAward.cadastrado" : "rede.meuAward.naoCadastrado")}</dd></div>
            <div><dt className="font-semibold">{t("rede.meuAward.videoPremiacao")}</dt><dd className="opacity-80">{t(p.video_premiacao_id ? "rede.meuAward.cadastrado" : "rede.meuAward.naoCadastrado")}</dd></div>
            <div>
              <dt className="font-semibold">{t("rede.meuAward.materia")}</dt>
              <dd>{p.materia_url?.startsWith("https://") ? <a href={p.materia_url} rel="noopener noreferrer" className="underline">{t("rede.meuAward.abrirMateria")}</a> : <span className="opacity-80">{t("rede.meuAward.naoCadastrada")}</span>}</dd>
            </div>
          </dl>
        </Cartao>
      </section>

      {pend ? (
        <section aria-labelledby={`an-${p.id}`} className="rounded-2xl border border-destaque/50 p-5">
          <h2 id={`an-${p.id}`} className="flex items-center gap-3 text-lg font-semibold"><Selo tom="destaque">{t("rede.meuAward.emAnalise")}</Selo>{pendente.alteracao_em ? <span className="text-sm font-normal opacity-70">{quando(pendente.alteracao_em, idioma)}</span> : null}</h2>
          <p className="mt-2 text-sm opacity-85">{t("rede.meuAward.emAnaliseTexto")}</p>
          {pend.historia ? <p className="mt-3 whitespace-pre-wrap text-sm"><strong>{t("rede.meuAward.historia")}: </strong>{pend.historia}</p> : null}
          {pend.materia_url ? <p className="mt-2 text-sm break-all"><strong>{t("rede.meuAward.materia")}: </strong>{pend.materia_url}</p> : null}
        </section>
      ) : null}
      {enviado && !pend ? <Aviso tipo="ok">{t("rede.meuAward.enviado")}</Aviso> : null}

      {editando ? (
        <form onSubmit={pedir} className="space-y-5 rounded-2xl border border-current/15 p-5">
          <h2 className="text-lg font-semibold">{t("rede.meuAward.pedirAlteracao")}</h2>
          <p className="text-sm opacity-80">{t(pend ? "rede.meuAward.substitui" : "rede.meuAward.passaPorAprovacao")}</p>
          {erro ? <Aviso tipo="erro">{t(erro)}</Aviso> : null}
          <div>
            <label htmlFor={`hi-${p.id}`} className="mb-2 block text-sm font-semibold">{t("rede.meuAward.historia")}</label>
            <textarea id={`hi-${p.id}`} name="historia" rows={6} maxLength={10000} defaultValue={pend?.historia ?? p.historia ?? ""} className={campoTexto} />
          </div>
          <Campo rotulo={t("rede.meuAward.materia")} name="materia_url" type="url" maxLength={500} defaultValue={pend?.materia_url ?? p.materia_url ?? ""} placeholder="https://" ajuda={t("rede.meuAward.materiaAjuda")} />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Botao type="button" variante="contorno" onClick={() => setEditando(false)} className="sm:w-auto">{t("comum.cancelar")}</Botao>
            <Botao type="submit" ocupado={ocupado} className="sm:w-auto">{t("rede.meuAward.enviarPedido")}</Botao>
          </div>
        </form>
      ) : (
        <Botao onClick={() => { setEditando(true); setEnviado(false) }} className="sm:w-auto">{t("rede.meuAward.pedirAlteracao")}</Botao>
      )}
    </div>
  )
}

export function MeuAward() {
  const t = useT()
  const caminho = useCaminho()
  useTitulo("rede.meuAward.titulo")
  const acesso = useAcesso()
  const { sessao } = useAuth()
  const uid = sessao?.user.id ?? ""
  const premiado = !acesso.carregando && !acesso.erro && acesso.premiado

  const { estado, recarregar } = useCarga(async () => {
    if (!premiado) return []
    const lista = ok(await supabase.from("premiados").select(COLUNAS).eq("perfil_id", uid).order("criado_em", { ascending: false }))
    const [edicoes, categorias, privados] = await Promise.all([
      supabase.from("edicoes").select("id, nome, ano").in("id", lista.map((p) => p.edicao_id)),
      supabase.from("categorias_premio").select("id, nome").in("id", lista.map((p) => p.categoria_id)),
      Promise.all(lista.map(async (p) => ok(await supabase.rpc("premiado_privado", { premiado: p.id })) as Pendente)),
    ])
    return lista.map((p, i) => ({
      p,
      edicao: ok(edicoes).find((e) => e.id === p.edicao_id)?.nome ?? "",
      categoria: ok(categorias).find((c) => c.id === p.categoria_id)?.nome ?? "",
      pendente: privados[i],
    }))
  }, `${premiado}`)

  // Sem registro de premiado a rota não existe (PRD 17.4.3): 404 dentro do layout, sem outro <main>.
  if (!acesso.carregando && !acesso.erro && !acesso.premiado)
    return (
      <div className="mx-auto max-w-3xl px-6 py-24">
        <h1 className="font-titulo text-4xl">{t("sistema.naoEncontrada")}</h1>
        <Link to={caminho("/inicio")} className="mt-8 inline-block underline">{t("sistema.voltar")}</Link>
      </div>
    )

  let corpo
  if (acesso.carregando || estado.fase === "carregando") corpo = <Esqueleto linhas={5} />
  else if (acesso.erro) corpo = <Erro aoTentar={acesso.recarregar}>{t("acesso.erro")}</Erro>
  else if (estado.fase === "erro") corpo = <Erro aoTentar={recarregar}>{t("rede.meuAward.erro")}</Erro>
  else if (estado.dados.length === 0) corpo = <Vazio>{t("rede.meuAward.vazio")}</Vazio>
  else
    corpo = (
      <div className="space-y-12">
        {estado.dados.map((x) => (
          <Premio key={x.p.id} p={x.p} edicao={x.edicao} categoria={x.categoria} pendente={x.pendente} aoMudar={recarregar} />
        ))}
      </div>
    )
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
      <h1 className="font-titulo text-4xl font-medium">{t("rede.meuAward.titulo")}</h1>
      <p className="mt-2 opacity-75">{t("rede.meuAward.intro")}</p>
      <div className="mt-8">{corpo}</div>
    </div>
  )
}
