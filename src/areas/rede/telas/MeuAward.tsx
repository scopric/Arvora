import { useState, type SubmitEvent } from "react"
import { Link } from "react-router"
import { Aviso } from "../../../componentes/Aviso"
import { Botao } from "../../../componentes/Botao"
import { Campo } from "../../../componentes/Campo"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { Selo } from "../../../componentes/Selo"
import { Vazio } from "../../../componentes/Vazio"
import { useCaminho, useIdioma, useT, type Chave } from "../../../i18n"
import { campoApp, useEstiloCampo } from "../../../componentes/campoEstilo"
import { linkTextoApp } from "../../../componentes/menuApp"
import { PaginaApp } from "../../../componentes/PaginaApp"
import { useAcesso } from "../../../lib/acesso"
import { useAuth } from "../../../lib/sessao"
import { supabase } from "../../../lib/supabase"
import { ok, quando, useCarga } from "../lib"

type Pendente = { alteracao_pendente: { historia?: string; materia_url?: string; foto_path?: string; redes?: unknown } | null; alteracao_em: string | null }

const COLUNAS = "id, edicao_id, categoria_id, nome, foto_path, historia, video_entrevista_id, video_premiacao_id, materia_url, publicado_em"

// `primario`: com mais de um prêmio, só o primeiro tem o botão dourado (um primário por tela).
function Premio({ p, edicao, categoria, pendente, aoMudar, primario }: {
  p: { id: number; nome: string; foto_path: string | null; historia: string | null; video_entrevista_id: string | null; video_premiacao_id: string | null; materia_url: string | null; publicado_em: string | null }
  edicao: string
  categoria: string
  pendente: Pendente
  aoMudar: () => void
  primario: boolean
}) {
  const t = useT()
  const idioma = useIdioma()
  const [editando, setEditando] = useState(false)
  const [erro, setErro] = useState<Chave | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const campo = useEstiloCampo()
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
        <h2 id={`pv-${p.id}`} className="text-corpo-p font-medium text-nevoa">{t("rede.meuAward.previa")}</h2>
        {/* Molde MasterClass (herói da classe): capa larga, nome em Big Shoulders, categoria · edição em dourado, selos. */}
        <div className="relative mt-3 overflow-hidden rounded-xl after:pointer-events-none after:absolute after:inset-0 after:rounded-xl after:shadow-borda">
          {foto ? <img src={foto} alt={`${t("rede.meuAward.fotoDe")} ${p.nome}`} className="aspect-video w-full object-cover" /> : null}
          <div className="space-y-5 p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Selo tom="dourado">{t("selo.premiado")}</Selo>
              <Selo tom={p.publicado_em ? "destaque" : "neutro"}>{t(p.publicado_em ? "rede.meuAward.publicado" : "rede.meuAward.naoPublicado")}</Selo>
            </div>
            <div>
              <h3 className="font-conteudo text-titulo-g font-[500] tracking-normal text-balance uppercase lg:text-conteudo-g">{p.nome}</h3>
              <p className="mt-2 text-corpo-p font-medium text-dourado">{categoria} · {edicao}</p>
            </div>
            {!foto ? <p className="text-corpo-p text-nevoa">{t("rede.meuAward.semFoto")}</p> : null}
            {p.historia ? <p className="max-w-prose text-base whitespace-pre-wrap">{p.historia}</p> : <p className="text-base text-nevoa">{t("rede.meuAward.semHistoria")}</p>}
            <dl className="grid gap-4 border-t border-grafite pt-5 sm:grid-cols-3">
              <div><dt className="text-corpo-p text-nevoa">{t("rede.meuAward.videoEntrevista")}</dt><dd className="mt-0.5 text-base">{t(p.video_entrevista_id ? "rede.meuAward.cadastrado" : "rede.meuAward.naoCadastrado")}</dd></div>
              <div><dt className="text-corpo-p text-nevoa">{t("rede.meuAward.videoPremiacao")}</dt><dd className="mt-0.5 text-base">{t(p.video_premiacao_id ? "rede.meuAward.cadastrado" : "rede.meuAward.naoCadastrado")}</dd></div>
              <div>
                <dt className="text-corpo-p text-nevoa">{t("rede.meuAward.materia")}</dt>
                <dd className="mt-0.5 text-base">{p.materia_url?.startsWith("https://") ? <a href={p.materia_url} rel="noopener noreferrer" className={linkTextoApp}>{t("rede.meuAward.abrirMateria")}</a> : <span>{t("rede.meuAward.naoCadastrada")}</span>}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {pend ? (
        <section aria-labelledby={`an-${p.id}`} className="rounded-xl p-5 shadow-borda">
          <h2 id={`an-${p.id}`} className="flex items-center gap-3 text-base font-semibold"><Selo tom="destaque">{t("rede.meuAward.emAnalise")}</Selo>{pendente.alteracao_em ? <span className="text-corpo-p font-normal text-nevoa">{quando(pendente.alteracao_em, idioma)}</span> : null}</h2>
          <p className="mt-2 text-base text-bruma">{t("rede.meuAward.emAnaliseTexto")}</p>
          {pend.historia ? <p className="mt-3 text-base whitespace-pre-wrap"><strong>{t("rede.meuAward.historia")}: </strong>{pend.historia}</p> : null}
          {pend.materia_url ? <p className="mt-2 text-base break-all"><strong>{t("rede.meuAward.materia")}: </strong>{pend.materia_url}</p> : null}
        </section>
      ) : null}
      {enviado && !pend ? <Aviso tipo="ok">{t("rede.meuAward.enviado")}</Aviso> : null}

      {editando ? (
        <form onSubmit={pedir} className="space-y-5 rounded-xl p-5 shadow-borda">
          <h2 className="text-subtitulo font-semibold">{t("rede.meuAward.pedirAlteracao")}</h2>
          <p className="text-base text-bruma">{t(pend ? "rede.meuAward.substitui" : "rede.meuAward.passaPorAprovacao")}</p>
          {erro ? <Aviso tipo="erro">{t(erro)}</Aviso> : null}
          <div>
            <label htmlFor={`hi-${p.id}`} className={campo.rotulo}>{t("rede.meuAward.historia")}</label>
            <textarea id={`hi-${p.id}`} name="historia" rows={6} maxLength={10000} defaultValue={pend?.historia ?? p.historia ?? ""} className={campoApp} />
          </div>
          <Campo rotulo={t("rede.meuAward.materia")} name="materia_url" type="url" maxLength={500} defaultValue={pend?.materia_url ?? p.materia_url ?? ""} placeholder="https://" ajuda={t("rede.meuAward.materiaAjuda")} />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Botao type="button" variante="contorno" onClick={() => setEditando(false)} className="sm:w-auto">{t("comum.cancelar")}</Botao>
            <Botao type="submit" variante={primario ? "primario" : "contorno"} ocupado={ocupado} className="sm:w-auto">{t("rede.meuAward.enviarPedido")}</Botao>
          </div>
        </form>
      ) : (
        <Botao variante={primario ? "primario" : "contorno"} onClick={() => { setEditando(true); setEnviado(false) }} className="sm:w-auto">{t("rede.meuAward.pedirAlteracao")}</Botao>
      )}
    </div>
  )
}

export function MeuAward() {
  const t = useT()
  const caminho = useCaminho()
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
      <PaginaApp chave="rede.meuAward.titulo" titulo={t("sistema.naoEncontrada")} estreita>
        <Link to={caminho("/inicio")} className={linkTextoApp}>{t("sistema.voltar")}</Link>
      </PaginaApp>
    )

  let corpo
  if (acesso.carregando || estado.fase === "carregando") corpo = <Esqueleto linhas={5} />
  else if (acesso.erro) corpo = <Erro aoTentar={acesso.recarregar}>{t("acesso.erro")}</Erro>
  else if (estado.fase === "erro") corpo = <Erro aoTentar={recarregar}>{t("rede.meuAward.erro")}</Erro>
  else if (estado.dados.length === 0) corpo = <Vazio>{t("rede.meuAward.vazio")}</Vazio>
  else
    corpo = (
      <div className="space-y-12">
        {estado.dados.map((x, i) => (
          <Premio key={x.p.id} p={x.p} edicao={x.edicao} categoria={x.categoria} pendente={x.pendente} aoMudar={recarregar} primario={i === 0} />
        ))}
      </div>
    )
  return (
    <PaginaApp chave="rede.meuAward.titulo" intro={t("rede.meuAward.intro")} estreita>
      {corpo}
    </PaginaApp>
  )
}
