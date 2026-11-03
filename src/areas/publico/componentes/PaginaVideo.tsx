import { useState } from "react"
import { Link, useLocation, useParams } from "react-router"
import { Aviso } from "../../../componentes/Aviso"
import { Bloqueado } from "../../../componentes/Bloqueado"
import { Botao } from "../../../componentes/Botao"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { PlayerVideo } from "../../../componentes/PlayerVideo"
import { useCaminho, useT, useTitulo, type Chave } from "../../../i18n"
import { temNivel, useAcesso } from "../../../lib/acesso"
import { useAuth } from "../../../lib/sessao"
import { supabase } from "../../../lib/supabase"
import { Pagina, SemRegistro } from "../Pagina"
import { linkPrimario } from "../../../componentes/botaoEstilo"
import { useTituloNome } from "../tituloAba"
import { useConsulta } from "../usarConsulta"

type Props = { tipo: "talk" | "original"; base: string; titulo: Chave }

// Página de um vídeo (Biblioteca e Originals). O vídeo inteiro vem da RPC video_do_video; a tabela só entrega
// `trailer_video_id`. Id que não começa com https:// vira "vídeo indisponível" no PlayerVideo
// (o provedor de vídeo ainda não foi decidido). O front escolhe o que mostrar pelo nível; o banco é quem barra.
export function PaginaVideo({ tipo, base, titulo }: Props) {
  const t = useT()
  const caminho = useCaminho()
  const { pathname } = useLocation()
  const { slug = "" } = useParams()
  const { sessao } = useAuth()
  const acesso = useAcesso()
  useTitulo(titulo)
  const uid = sessao?.user.id ?? null
  const video = useConsulta(
    () =>
      supabase
        .from("videos")
        .select("id,titulo,descricao,duracao_min,nivel_minimo,trailer_video_id")
        .eq("tipo", tipo)
        .eq("slug", slug)
        .not("publicado_em", "is", null)
        .maybeSingle() as unknown as PromiseLike<{ data: DadosVideo | null; error: unknown }>,
    `video/${tipo}/${slug}/${uid}`,
  )
  const v = video.dados
  useTituloNome(v ? v.titulo : video.carregando || video.erro ? null : t("publico.semRegistro.titulo"), !v && !video.carregando && !video.erro)

  if (video.carregando || acesso.carregando) return <Pagina titulo={t(titulo)}><Esqueleto linhas={6} /></Pagina>
  if (video.erro) return <Pagina titulo={t(titulo)}><Erro aoTentar={video.recarregar} /></Pagina>
  if (!v) return <SemRegistro voltar={base} rotulo="publico.video.voltar" />
  if (acesso.erro) return <Pagina titulo={v.titulo}><Erro aoTentar={acesso.recarregar}>{t("acesso.erro")}</Erro></Pagina>

  const completo = Boolean(uid) && temNivel(acesso.nivel, v.nivel_minimo)
  const minimo = v.nivel_minimo === "grupo" ? "grupo" : "clube"
  return (
    <Pagina titulo={v.titulo} apoio={v.descricao} largura="max-w-4xl">
      {completo ? (
        <VideoCompleto id={v.id} titulo={v.titulo} />
      ) : (
        <div className="space-y-6">
          {v.trailer_video_id ? <PlayerVideo titulo={`${v.titulo} — ${t("publico.video.trecho")}`} tipo="embed" src={v.trailer_video_id} /> : null}
          {v.nivel_minimo === "visitante" && !uid ? (
            <div>
              <p className="max-w-prose text-lg">{t("publico.video.entrar")}</p>
              <Link to={caminho("/entrar")} state={{ de: pathname }} className={`${linkPrimario} mt-4`}>{t("nav.entrar")}</Link>
            </div>
          ) : (
            <Bloqueado minimo={minimo} frase={t(minimo === "grupo" ? "publico.video.restoGrupo" : "publico.video.restoClube")} />
          )}
        </div>
      )}
      {v.duracao_min ? <p className="mt-4 font-mono text-xs tracking-[0.1em] text-creme/70">{v.duracao_min} {t("publico.video.min")}</p> : null}
      {uid ? <Salvar videoId={v.id} uid={uid} /> : null}
      <Citados videoId={v.id} />
      <p className="mt-10">
        <Link to={caminho(base)} className="underline decoration-dourado underline-offset-4">{t("publico.video.voltar")}</Link>
      </p>
    </Pagina>
  )
}

type DadosVideo = { id: number; titulo: string; descricao: string | null; duracao_min: number | null; nivel_minimo: "visitante" | "clube" | "grupo"; trailer_video_id: string | null }

// O vídeo inteiro vem da RPC video_do_video (o banco decide o acesso; erro sem_acesso ou RPC ausente = "vídeo indisponível").
// Não existe nos tipos gerados ainda: chamada sem tipo até `types:gerar` rodar com a migration nova.
function VideoCompleto({ id, titulo }: { id: number; titulo: string }) {
  const t = useT()
  const r = useConsulta(
    () => (supabase.rpc as unknown as (f: string, a: object) => PromiseLike<{ data: string | null; error: unknown }>)("video_do_video", { p_video: id }),
    `video-completo/${id}`,
  )
  if (r.carregando) return <Esqueleto linhas={4} />
  if (r.erro || !r.dados) return <Erro>{t("video.indisponivel")}</Erro>
  return <PlayerVideo titulo={titulo} tipo="embed" src={r.dados} />
}

// BIB-02: quem aparece no vídeo, com link para o Hall of Fame (página pré-renderizada: <a> comum) ou para o Directory.
function Citados({ videoId }: { videoId: number }) {
  const t = useT()
  const caminho = useCaminho()
  const r = useConsulta(
    () => supabase.from("videos_citados").select("id,premiados(nome,slug,edicoes(slug)),empresas(nome,slug)").eq("video_id", videoId).order("id"),
    `citados/${videoId}`,
  )
  const lista = r.dados ?? []
  if (r.carregando) return null
  return (
    <section aria-labelledby="citados" className="mt-12">
      <h2 id="citados" className="mb-4 font-titulo text-3xl font-normal">{t("publico.video.quem")}</h2>
      {r.erro ? (
        <Erro aoTentar={r.recarregar} />
      ) : lista.length === 0 ? (
        <p className="text-creme/70">{t("publico.video.ninguem")}</p>
      ) : (
        <ul className="space-y-2">
          {lista.map((c) => {
            const p = c.premiados
            const e = c.empresas
            if (p?.edicoes) {
              return <li key={c.id}><a href={caminho(`/hall-of-fame/${p.edicoes.slug}/${p.slug}`)} className="underline decoration-dourado underline-offset-4">{p.nome}</a> <span className="text-creme/70">· {t("selo.premiado")}</span></li>
            }
            if (e) return <li key={c.id}><Link to={caminho(`/directory/${e.slug}`)} className="underline decoration-dourado underline-offset-4">{e.nome}</Link> <span className="text-creme/70">· {t("menu.directory")}</span></li>
            return null
          })}
        </ul>
      )}
    </section>
  )
}

// Salvar (só logado). Insere {video_id}; o perfil vem de auth.uid() no banco. Apagar também confere a linha devolvida.
function Salvar({ videoId, uid }: { videoId: number; uid: string }) {
  const t = useT()
  const salvo = useConsulta(() => supabase.from("salvos").select("id").eq("video_id", videoId).maybeSingle(), `salvo/${videoId}/${uid}`)
  const [feito, setFeito] = useState<{ de: string; id: number | null } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [falha, setFalha] = useState(false)
  if (salvo.carregando) return null
  // O estado local só vale para a leitura a que ele responde (muda a chave, volta a valer o banco).
  const id = feito?.de === `${videoId}/${uid}` ? feito.id : (salvo.dados?.id ?? null)

  async function alternar() {
    setOcupado(true)
    setFalha(false)
    const r = id === null
      ? await supabase.from("salvos").insert({ video_id: videoId }).select("id")
      : await supabase.from("salvos").delete().eq("id", id).select("id")
    setOcupado(false)
    if (r.error || !r.data?.length) return setFalha(true)
    setFeito({ de: `${videoId}/${uid}`, id: id === null ? r.data[0].id : null })
  }
  return (
    <div className="mt-6">
      {salvo.erro ? <Erro aoTentar={salvo.recarregar} /> : (
        <Botao variante="contorno" ocupado={ocupado} aria-pressed={id !== null} onClick={alternar} className="sm:w-auto">
          {t(id === null ? "publico.video.salvar" : "publico.video.salvo")}
        </Botao>
      )}
      {falha ? <div className="mt-3"><Aviso tipo="erro">{t("publico.video.erroSalvar")}</Aviso></div> : null}
    </div>
  )
}
