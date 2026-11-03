import { Link, useParams } from "react-router"
import { Bloqueado } from "../../../componentes/Bloqueado"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { LinkVoltar } from "../../../componentes/LinkVoltar"
import { MolduraApp } from "../../../componentes/PaginaApp"
import { Selo } from "../../../componentes/Selo"
import { Vazio } from "../../../componentes/Vazio"
import { useCaminho, useIdioma, useT } from "../../../i18n"
import { temNivel, useAcesso } from "../../../lib/acesso"
import { useAuth } from "../../../lib/sessao"
import { supabase } from "../../../lib/supabase"
import { Agenda } from "../componentes/Agenda"
import { Gravacao } from "../componentes/Gravacao"
import { Materiais } from "../componentes/Materiais"
import { Pagina } from "../componentes/Pagina"
import { QuandoAula } from "../componentes/QuandoAula"
import { SalaAoVivo } from "../componentes/SalaAoVivo"
import { COLUNAS_AULA, nomeVertical, type AulaLinha, type Vertical } from "../tipos"
import { useCarga } from "../useCarga"
import { dados, linkTexto } from "../util"

type AulaComVertical = AulaLinha & { verticais: Vertical | null }

// /aulas/:slug. Ao vivo (ainda sem materiais publicados): sala com o botão "Entrar". Gravada: player + abas Resumo,
// E-book e Exercícios. Abaixo do nível da aula: prévia com cadeado (PRD §17.1 nº1).
// Molde MasterClass (lição, tela 93622e8c): player largo à esquerda com título 24/600 e descrição; painel de vidro
// à direita com a vertical, a data e as abas de materiais (no celular, abaixo).
export function Aula() {
  const { slug } = useParams()
  const t = useT()
  const lang = useIdioma()
  const caminho = useCaminho()
  const acesso = useAcesso()
  const { sessao } = useAuth()
  const uid = sessao?.user.id
  const [estado, recarregar] = useCarga(async () => {
    const r = await supabase.from("aulas").select(`${COLUNAS_AULA}, verticais(nome, nome_en, slug, aceita_entregas)`).eq("slug", slug ?? "").maybeSingle()
    return dados(r) as unknown as AulaComVertical | null
  }, slug)
  const [proxima] = useCarga(async () => {
    if (estado.fase !== "ok" || !estado.dados?.inicio_em || estado.dados.tipo === "ao_vivo") return null
    const r = await supabase
      .from("aulas")
      .select("slug, titulo")
      .eq("vertical_id", estado.dados.vertical_id)
      .not("materiais_publicados_em", "is", null)
      .gt("inicio_em", estado.dados.inicio_em)
      .order("inicio_em")
      .limit(1)
      .maybeSingle()
    return dados(r)
  }, estado.fase === "ok" ? estado.dados?.id : undefined)

  if (acesso.carregando || estado.fase === "carregando") return <Pagina chave="aprender.aula.titulo"><Esqueleto linhas={6} /></Pagina>
  if (acesso.erro) return <Pagina chave="aprender.aula.titulo"><Erro aoTentar={acesso.recarregar}>{t("acesso.erro")}</Erro></Pagina>
  if (estado.fase === "erro") return <Pagina chave="aprender.aula.titulo"><Erro aoTentar={recarregar} /></Pagina>
  const aula = estado.dados
  if (!aula)
    return (
      <Pagina chave="aprender.aula.titulo" titulo={t("aprender.naoEncontrada")}>
        <Link to={caminho("/aulas")} className={linkTexto}>{t("aprender.voltarAulas")}</Link>
      </Pagina>
    )

  const aoVivo = aula.tipo === "ao_vivo" && !aula.materiais_publicados_em
  const permitido = temNivel(acesso.nivel, aula.nivel_minimo)
  const vertical = aula.verticais ? nomeVertical(aula.verticais, lang) : ""
  const voltar = { para: caminho("/aulas"), rotulo: t("aprender.voltarAulas") }
  const cabecalho = (
    <>
      <h1 className="text-titulo-p font-semibold">{aula.titulo}</h1>
      {aula.descricao ? <p className="mt-2 max-w-prose text-corpo text-cinza">{aula.descricao}</p> : null}
    </>
  )
  // Cabeçalho do painel: vertical e selo, data e duração (o "instrutor + curso" do molde).
  const painelTopo = (
    <div className="px-2 pt-1 pb-3">
      <p className="flex flex-wrap items-center gap-2 text-corpo font-semibold">
        {vertical}
        {aoVivo ? <Selo tom="destaque">{t("aprender.aoVivo")}</Selo> : null}
      </p>
      {aula.inicio_em || aula.duracao_min ? (
        <p className="mt-1 text-corpo-p text-cinza">
          {aula.inicio_em ? <QuandoAula inicio={aula.inicio_em} /> : null}
          {aula.duracao_min ? <> · {aula.duracao_min} {t("aprender.min")}</> : null}
        </p>
      ) : null}
    </div>
  )
  const painel = "rounded-lg p-3 vidro lg:sticky lg:top-24 lg:self-start"

  if (!permitido)
    return (
      <Pagina chave="aprender.aula.titulo" titulo={aula.titulo} rotulo={vertical} voltar={voltar}>
        <Bloqueado previa={<p className="text-corpo">{aula.descricao ?? aula.titulo}</p>} frase={t("aprender.aulas.bloqueado")} minimo={aula.nivel_minimo === "clube" ? "clube" : "grupo"} />
      </Pagina>
    )

  return (
    <MolduraApp chave="aprender.aula.titulo">
      <LinkVoltar {...voltar} />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {aoVivo ? (
          // Ao vivo nunca cai no player: sem inicio_em (o banco não deixa, mas a tela não presume) não há sala nem agenda.
          <div className="min-w-0 space-y-6">
            {cabecalho}
            {aula.inicio_em ? (
              <>
                <SalaAoVivo aulaId={aula.id} inicio={aula.inicio_em} duracaoMin={aula.duracao_min} />
                <Agenda aula={{ ...aula, inicio_em: aula.inicio_em }} />
              </>
            ) : (
              <Erro>{t("aprender.sala.indisponivel")}</Erro>
            )}
          </div>
        ) : uid ? (
          <div className="min-w-0 space-y-6">
            <Gravacao aulaId={aula.id} titulo={aula.titulo} uid={uid}>{cabecalho}</Gravacao>
            {proxima.fase === "ok" && proxima.dados ? (
              <p>
                <Link to={caminho(`/aulas/${proxima.dados.slug}`)} className={linkTexto}>{t("aprender.proxima")}: {proxima.dados.titulo} <span aria-hidden="true">→</span></Link>
              </p>
            ) : null}
          </div>
        ) : null}
        <div className={painel}>
          {painelTopo}
          {aoVivo ? <Vazio>{t("aprender.materiais.emBreve")}</Vazio> : uid ? <Materiais aulaId={aula.id} uid={uid} podeEnviar={!!aula.verticais?.aceita_entregas && temNivel(acesso.nivel, "grupo")} doGrupo={temNivel(acesso.nivel, "grupo")} /> : null}
        </div>
      </div>
    </MolduraApp>
  )
}
