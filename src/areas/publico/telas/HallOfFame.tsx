import { Link, useParams } from "react-router"
import { Cartao } from "../../../componentes/Cartao"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { Vazio } from "../../../componentes/Vazio"
import { useCaminho, useT, useTitulo } from "../../../i18n"
import { supabase } from "../../../lib/supabase"
import { urlImagem } from "../formatos"
import { Pagina, SemRegistro } from "../Pagina"
import { useTituloNome } from "../tituloAba"
import { useConsulta } from "../usarConsulta"

// Só premiados publicados (a policy do banco já esconde o resto; o filtro explícito deixa a intenção escrita).
// Os dados vêm do banco no navegador: o Hall of Fame não é mais pré-renderizado (Decisão 67).
export function HallOfFame() {
  const t = useT()
  const caminho = useCaminho()
  useTitulo("menu.hallOfFame")
  const r = useConsulta(
    () => supabase.from("premiados").select("id,nome,slug,edicoes!inner(slug,nome,ano),categorias_premio(nome)").not("publicado_em", "is", null).order("nome"),
    "hof",
  )
  return (
    <Pagina titulo={t("menu.hallOfFame")} apoio={t("publico.awards.hall")}>
      {r.carregando ? <Esqueleto linhas={6} /> : r.erro ? <Erro aoTentar={r.recarregar} /> : !r.dados?.length ? <Vazio>{t("publico.hof.vazio")}</Vazio> : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {r.dados.map((p) => (
            <li key={p.id}>
              <Cartao className="h-full">
                <Link to={caminho(`/hall-of-fame/${p.edicoes.slug}/${p.slug}`)} className="font-titulo text-2xl underline decoration-dourado underline-offset-4">{p.nome}</Link>
                <p className="mt-2 text-sm text-creme/75">{[p.categorias_premio?.nome, p.edicoes.nome].filter(Boolean).join(" · ")}</p>
              </Cartao>
            </li>
          ))}
        </ul>
      )}
    </Pagina>
  )
}

export function Premiado() {
  const t = useT()
  const caminho = useCaminho()
  const { edicao = "", slug = "" } = useParams()
  useTitulo("menu.hallOfFame")
  const r = useConsulta(
    () => supabase.from("premiados").select("id,nome,historia,foto_path,materia_url,edicoes!inner(slug,nome),categorias_premio(nome)").eq("slug", slug).eq("edicoes.slug", edicao).not("publicado_em", "is", null).maybeSingle(),
    `premiado/${edicao}/${slug}`,
  )
  const p = r.dados
  useTituloNome(p ? p.nome : r.carregando || r.erro ? null : t("publico.semRegistro.titulo"), !p && !r.carregando && !r.erro)
  if (r.carregando) return <Pagina titulo={t("menu.hallOfFame")}><Esqueleto linhas={6} /></Pagina>
  if (r.erro) return <Pagina titulo={t("menu.hallOfFame")}><Erro aoTentar={r.recarregar} /></Pagina>
  if (!p) return <SemRegistro voltar="/hall-of-fame" rotulo="publico.hof.voltar" />
  const foto = urlImagem(p.foto_path)
  const materia = p.materia_url && /^https:\/\//i.test(p.materia_url) ? p.materia_url : null
  return (
    <Pagina titulo={p.nome} largura="max-w-3xl">
      <p className="-mt-6 mb-8 font-mono text-xs tracking-[0.15em] text-creme/70 uppercase">{[p.categorias_premio?.nome, p.edicoes.nome].filter(Boolean).join(" · ")}</p>
      {foto ? <img src={foto} alt={p.nome} className="mb-8 max-h-96 w-auto rounded-xl object-cover" /> : null}
      {p.historia ? <p className="max-w-prose text-lg leading-relaxed whitespace-pre-line text-creme/85">{p.historia}</p> : null}
      {materia ? <p className="mt-6"><a href={materia} rel="noopener noreferrer nofollow" className="underline decoration-dourado underline-offset-4">{t("publico.hof.materia")}</a></p> : null}
      <Link to={caminho("/hall-of-fame")} className="mt-10 inline-flex min-h-11 items-center underline">{t("publico.hof.voltar")}</Link>
    </Pagina>
  )
}
