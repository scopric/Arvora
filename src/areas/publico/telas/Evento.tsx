import { Link, useParams } from "react-router"
import { Cartao } from "../../../componentes/Cartao"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { PlayerVideo } from "../../../componentes/PlayerVideo"
import { Vazio } from "../../../componentes/Vazio"
import { useCaminho, useIdioma, useT, useTitulo } from "../../../i18n"
import { useAcesso } from "../../../lib/acesso"
import { supabase } from "../../../lib/supabase"
import { dataLonga, diaCurto, horaDublinBrasilia, urlImagem } from "../formatos"
import { Pagina, SemRegistro, linkPrimario } from "../Pagina"
import { useConsulta } from "../usarConsulta"

const https = (url: string | null | undefined) => (url && /^https:\/\//i.test(url) && URL.canParse(url) ? url : null)
const titulo2 = "mb-4 font-titulo text-3xl font-bold uppercase"

// Página da edição (EVE-01/02/03). A fase vem do banco (`fase`, calculada pelas datas da edição): antes, durante ou depois.
export function Evento() {
  const t = useT()
  const idioma = useIdioma()
  const caminho = useCaminho()
  const { edicao = "" } = useParams()
  const { nivel } = useAcesso()
  useTitulo("publico.evento.titulo")
  const r = useConsulta(
    () => supabase.from("edicoes").select("id,nome,ano,cidade,pais,descricao,durante_inicio,durante_fim,transmissao_url,gravacao_video_id,fase").eq("slug", edicao).maybeSingle(),
    `edicao/${edicao}`,
  )
  const e = r.dados
  if (r.carregando) return <Pagina titulo={t("publico.evento.titulo")}><Esqueleto linhas={6} /></Pagina>
  if (r.erro) return <Pagina titulo={t("publico.evento.titulo")}><Erro aoTentar={r.recarregar} /></Pagina>
  if (!e) return <SemRegistro voltar="/awards" rotulo="publico.evento.voltar" />
  const fase = e.fase === "durante" || e.fase === "depois" ? e.fase : "antes"
  const transmissao = https(e.transmissao_url)
  return (
    <Pagina titulo={e.nome} apoio={e.descricao}>
      <p className="-mt-6 mb-10 font-mono text-xs tracking-[0.15em] text-creme/70 uppercase">
        {t(`publico.evento.fase.${fase}`)} · {e.cidade}, {e.pais} · {dataLonga(e.durante_inicio, idioma)}
      </p>

      {fase === "durante" ? (
        <>
          {transmissao ? (
            <p className="mb-10">
              <a href={transmissao} rel="noopener noreferrer" className={linkPrimario}>{t("publico.evento.assistir")}</a>
            </p>
          ) : null}
          <Agenda edicaoId={e.id} />
        </>
      ) : null}
      {fase === "depois" ? (
        <>
          {e.gravacao_video_id ? (
            <section aria-labelledby="gravacao" className="mb-12">
              <h2 id="gravacao" className={titulo2}>{t("publico.evento.gravacao")}</h2>
              <PlayerVideo titulo={`${e.nome} — ${t("publico.evento.gravacao")}`} tipo="embed" src={e.gravacao_video_id} />
            </section>
          ) : null}
          <Premiados edicaoId={e.id} edicaoSlug={edicao} />
          {nivel === "visitante" ? (
            <Cartao className="mt-12">
              <p className="max-w-prose text-lg">{t("publico.evento.convite")}</p>
              <Link to={caminho("/planos")} className={`${linkPrimario} mt-5`}>{t("menu.planos")}</Link>
            </Cartao>
          ) : null}
        </>
      ) : null}
      {fase !== "depois" ? <Indicados edicaoId={e.id} /> : null}
      <Patrocinadores edicaoId={e.id} />
    </Pagina>
  )
}

function Agenda({ edicaoId }: { edicaoId: number }) {
  const t = useT()
  const idioma = useIdioma()
  const r = useConsulta(() => supabase.from("agenda_evento").select("id,inicio_em,titulo,descricao,local").eq("edicao_id", edicaoId).order("inicio_em"), `agenda/${edicaoId}`)
  return (
    <section aria-labelledby="agenda" className="mb-12">
      <h2 id="agenda" className={titulo2}>{t("publico.evento.agenda")}</h2>
      {r.carregando ? <Esqueleto /> : r.erro ? <Erro aoTentar={r.recarregar} /> : !r.dados?.length ? <Vazio>{t("publico.evento.agendaVazia")}</Vazio> : (
        <ol className="divide-y divide-creme/15 border-y border-creme/15">
          {r.dados.map((a) => {
            const h = horaDublinBrasilia(a.inicio_em, idioma)
            return (
              <li key={a.id} className="grid gap-1 py-4 sm:grid-cols-[11rem_1fr] sm:gap-6">
                <p className="font-mono text-sm text-creme/80">
                  {diaCurto(a.inicio_em, idioma)}
                  <br />Dublin {h.dublin} · Brasília {h.brasilia}
                </p>
                <div>
                  <p className="font-semibold">{a.titulo}</p>
                  {a.descricao ? <p className="text-creme/80">{a.descricao}</p> : null}
                  {a.local ? <p className="text-sm text-creme/70">{a.local}</p> : null}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

function Indicados({ edicaoId }: { edicaoId: number }) {
  const t = useT()
  const cats = useConsulta(() => supabase.from("categorias_premio").select("id,nome").eq("edicao_id", edicaoId).order("ordem"), `cats/${edicaoId}`)
  const ind = useConsulta(() => supabase.from("indicados").select("id,categoria_id,nome,resumo").eq("edicao_id", edicaoId).not("publicado_em", "is", null).order("nome"), `ind/${edicaoId}`)
  return (
    <section aria-labelledby="indicados" className="mb-12">
      <h2 id="indicados" className={titulo2}>{t("publico.evento.indicados")}</h2>
      {cats.carregando || ind.carregando ? <Esqueleto /> : cats.erro || ind.erro ? <Erro aoTentar={() => (cats.recarregar(), ind.recarregar())} /> : !ind.dados?.length ? <Vazio>{t("publico.evento.indicadosVazio")}</Vazio> : (
        <div className="space-y-8">
          {(cats.dados ?? []).map((c) => {
            const lista = (ind.dados ?? []).filter((i) => i.categoria_id === c.id)
            return lista.length ? (
              <div key={c.id}>
                <h3 className="mb-2 font-semibold text-dourado">{c.nome}</h3>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {lista.map((i) => (
                    <li key={i.id}><Cartao><p className="font-semibold">{i.nome}</p>{i.resumo ? <p className="mt-1 text-creme/80">{i.resumo}</p> : null}</Cartao></li>
                  ))}
                </ul>
              </div>
            ) : null
          })}
        </div>
      )}
    </section>
  )
}

function Premiados({ edicaoId, edicaoSlug }: { edicaoId: number; edicaoSlug: string }) {
  const t = useT()
  const caminho = useCaminho()
  const r = useConsulta(() => supabase.from("premiados").select("id,nome,slug").eq("edicao_id", edicaoId).not("publicado_em", "is", null).order("nome"), `premiados/${edicaoId}`)
  if (r.carregando) return <Esqueleto />
  if (r.erro) return <Erro aoTentar={r.recarregar} />
  if (!r.dados?.length) return null
  return (
    <section aria-labelledby="premiados" className="mb-12">
      <h2 id="premiados" className={titulo2}>{t("publico.evento.premiados")}</h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {r.dados.map((p) => (
          <li key={p.id}><a href={caminho(`/hall-of-fame/${edicaoSlug}/${p.slug}`)} className="inline-flex min-h-11 items-center underline decoration-dourado underline-offset-4">{p.nome}</a></li>
        ))}
      </ul>
    </section>
  )
}

function Patrocinadores({ edicaoId }: { edicaoId: number }) {
  const t = useT()
  const r = useConsulta(() => supabase.from("patrocinadores").select("id,nome,logo_path,site,nivel").eq("edicao_id", edicaoId).order("ordem"), `patro/${edicaoId}`)
  if (r.carregando) return null
  if (r.erro) return <Erro aoTentar={r.recarregar} />
  if (!r.dados?.length) return null
  return (
    <section aria-labelledby="patro" className="mb-4">
      <h2 id="patro" className={titulo2}>{t("publico.evento.patrocinadores")}</h2>
      <ul className="grid gap-4 sm:grid-cols-3">
        {r.dados.map((p) => {
          const logo = urlImagem(p.logo_path)
          const site = https(p.site)
          return (
            <li key={p.id}>
              <Cartao className="flex h-full flex-col items-start gap-3">
                {logo ? <img src={logo} alt={p.nome} loading="lazy" className="h-12 w-auto max-w-40 object-contain" /> : null}
                {site ? <a href={site} rel="noopener noreferrer nofollow" className="font-semibold underline decoration-dourado underline-offset-4">{p.nome}</a> : <span className="font-semibold">{p.nome}</span>}
                {p.nivel ? <span className="font-mono text-xs tracking-[0.1em] text-creme/70">{p.nivel}</span> : null}
              </Cartao>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
