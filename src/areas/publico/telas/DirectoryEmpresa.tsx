import { Link, useParams } from "react-router"
import { Cartao } from "../../../componentes/Cartao"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { Selo } from "../../../componentes/Selo"
import { useCaminho, useIdioma, useT, useTitulo } from "../../../i18n"
import { useAuth } from "../../../lib/sessao"
import { supabase } from "../../../lib/supabase"
import { nomeLocalizado, urlImagem } from "../formatos"
import { Pagina, SemRegistro, linkContorno } from "../Pagina"
import { useTituloNome } from "../tituloAba"
import { useConsulta } from "../usarConsulta"

type Empresa = { id: number; nome: string; setor_id: number; cidade: string | null; pais: string | null; logo_path: string | null; site?: string | null; descricao?: string | null }

const https = (url: string | null | undefined) => (url && /^https?:\/\//i.test(url) && URL.canParse(url) ? url : null)

// Página da empresa (DIR-01). O visitante lê o resumo (nome, área, cidade, logo); site e descrição só chegam a quem tem sessão
// (o banco não entrega essas colunas ao anônimo). Dono da empresa fica fora: o dado não é público.
export function DirectoryEmpresa() {
  const t = useT()
  const { slug = "" } = useParams()
  const { sessao } = useAuth()
  useTitulo("publico.directoryEmpresa.titulo")
  const uid = sessao?.user.id ?? null
  const colunas = `id,nome,setor_id,cidade,pais,logo_path${uid ? ",site,descricao" : ""}`
  const r = useConsulta(
    () => supabase.from("empresas").select(colunas).eq("slug", slug).eq("status", "publicada").maybeSingle() as unknown as PromiseLike<{ data: Empresa | null; error: unknown }>,
    `empresa/${slug}/${uid}`,
  )
  const e = r.dados
  useTituloNome(e ? e.nome : r.carregando || r.erro ? null : t("publico.semRegistro.titulo"), !e && !r.carregando && !r.erro)

  if (r.carregando) return <Pagina titulo={t("publico.directoryEmpresa.titulo")}><Esqueleto linhas={5} /></Pagina>
  if (r.erro) return <Pagina titulo={t("publico.directoryEmpresa.titulo")}><Erro aoTentar={r.recarregar} /></Pagina>
  if (!e) return <SemRegistro voltar="/directory" rotulo="publico.directoryEmpresa.voltar" />
  return <Conteudo e={e} logado={Boolean(uid)} />
}

// As consultas de apoio (área, premiado, parecidas) só começam depois que a empresa existe; cada erro aparece no seu bloco.
function Conteudo({ e, logado }: { e: Empresa; logado: boolean }) {
  const t = useT()
  const idioma = useIdioma()
  const caminho = useCaminho()
  const setor = useConsulta(() => supabase.from("setores").select("id,nome,nome_en").eq("id", e.setor_id).maybeSingle(), `setor/${e.setor_id}`)
  const premiado = useConsulta(
    () => supabase.from("premiados").select("id,nome,slug,edicoes(slug)").eq("empresa_id", e.id).not("publicado_em", "is", null).limit(1),
    `premiado-de/${e.id}`,
  )
  const parecidas = useConsulta(
    () => supabase.from("empresas").select("id,nome,slug,cidade").eq("status", "publicada").eq("setor_id", e.setor_id).neq("id", e.id).order("nome").limit(3),
    `parecidas/${e.id}`,
  )
  const logo = urlImagem(e.logo_path)
  const site = https(e.site)
  const p = premiado.dados?.[0]
  const local = [setor.dados && nomeLocalizado(setor.dados, idioma), e.cidade, e.pais].filter(Boolean).join(" · ")
  return (
    <Pagina titulo={e.nome} largura="max-w-4xl">
      <div className="flex flex-wrap items-center gap-3">
        {p?.edicoes ? <Selo tom="dourado">{t("selo.premiado")}</Selo> : null}
        {local ? <p className="text-lg text-creme/80">{local}</p> : null}
      </div>
      {setor.erro || premiado.erro ? <div className="mt-6"><Erro aoTentar={() => (setor.recarregar(), premiado.recarregar())} /></div> : null}
      {logo ? <img src={logo} alt={`${t("publico.directoryEmpresa.logo")} ${e.nome}`} className="mt-6 h-20 w-auto max-w-64 object-contain" /> : null}
      {logado ? (
        <div className="mt-8 space-y-4">
          {e.descricao ? <p className="max-w-prose whitespace-pre-line text-lg">{e.descricao}</p> : null}
          {site ? (
            <p>
              <a href={site} rel="noopener noreferrer nofollow" className="underline decoration-dourado underline-offset-4">{t("publico.directoryEmpresa.site")}</a>
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-8 max-w-prose text-creme/80">
          {t("publico.directoryEmpresa.entrar")}{" "}
          <Link to={caminho("/entrar")} className="underline decoration-dourado underline-offset-4">{t("nav.entrar")}</Link>
        </p>
      )}
      {p?.edicoes ? (
        <p className="mt-6">
          <a href={caminho(`/hall-of-fame/${p.edicoes.slug}/${p.slug}`)} className={linkContorno}>{t("publico.directoryEmpresa.verPremiado")}</a>
        </p>
      ) : null}
      {parecidas.erro ? (
        <div className="mt-14"><Erro aoTentar={parecidas.recarregar} /></div>
      ) : parecidas.dados?.length ? (
        <section aria-labelledby="parecidas" className="mt-14">
          <h2 id="parecidas" className="mb-4 font-titulo text-3xl font-normal">{t("publico.directoryEmpresa.parecidas")}</h2>
          <ul className="grid gap-5 sm:grid-cols-3">
            {parecidas.dados.map((o) => (
              <li key={o.id}>
                <Cartao>
                  <Link to={caminho(`/directory/${o.slug}`)} className="font-semibold underline decoration-dourado underline-offset-4">{o.nome}</Link>
                  {o.cidade ? <p className="mt-1 text-sm text-creme/70">{o.cidade}</p> : null}
                </Cartao>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="mt-10">
        <Link to={caminho("/directory")} className="underline decoration-dourado underline-offset-4">{t("publico.directoryEmpresa.voltar")}</Link>
      </p>
    </Pagina>
  )
}
