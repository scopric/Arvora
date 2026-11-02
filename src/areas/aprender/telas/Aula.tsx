import { Link, useParams } from "react-router"
import { Bloqueado } from "../../../componentes/Bloqueado"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
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
// Molde MasterClass (lição): player largo à esquerda, painel de materiais à direita (no celular, abaixo).
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
  const rotulo = [vertical, aoVivo ? t("aprender.aoVivo") : null].filter(Boolean).join(" · ")
  const meta = aula.inicio_em || aula.duracao_min ? (
    <>
      {aula.inicio_em ? <QuandoAula inicio={aula.inicio_em} /> : null}
      {aula.duracao_min ? <> · {aula.duracao_min} {t("aprender.min")}</> : null}
    </>
  ) : undefined
  const painel = "lg:sticky lg:top-16 lg:self-start"

  return (
    <Pagina chave="aprender.aula.titulo" titulo={aula.titulo} conteudo rotulo={rotulo} meta={meta} voltar={{ para: caminho("/aulas"), rotulo: t("aprender.voltarAulas") }}>
      {!permitido ? (
        <Bloqueado previa={<p className="text-base">{aula.descricao ?? aula.titulo}</p>} frase={t("aprender.aulas.bloqueado")} minimo={aula.nivel_minimo === "clube" ? "clube" : "grupo"} />
      ) : aoVivo ? (
        // Ao vivo nunca cai no player: sem inicio_em (o banco não deixa, mas a tela não presume) não há sala nem agenda.
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-6">
            {aula.inicio_em ? (
              <>
                <SalaAoVivo aulaId={aula.id} inicio={aula.inicio_em} duracaoMin={aula.duracao_min} />
                <Agenda aula={{ ...aula, inicio_em: aula.inicio_em }} />
              </>
            ) : (
              <Erro>{t("aprender.sala.indisponivel")}</Erro>
            )}
            {aula.descricao ? <p className="max-w-prose text-base text-bruma">{aula.descricao}</p> : null}
          </div>
          <div className={painel}><Vazio>{t("aprender.materiais.emBreve")}</Vazio></div>
        </div>
      ) : uid ? (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-6">
            <Gravacao aulaId={aula.id} titulo={aula.titulo} uid={uid} />
            {aula.descricao ? <p className="max-w-prose text-base text-bruma">{aula.descricao}</p> : null}
            {proxima.fase === "ok" && proxima.dados ? (
              <p>
                <Link to={caminho(`/aulas/${proxima.dados.slug}`)} className={linkTexto}>{t("aprender.proxima")}: {proxima.dados.titulo} <span aria-hidden="true">→</span></Link>
              </p>
            ) : null}
          </div>
          <div className={painel}>
            <Materiais aulaId={aula.id} uid={uid} podeEnviar={!!aula.verticais?.aceita_entregas && temNivel(acesso.nivel, "grupo")} doGrupo={temNivel(acesso.nivel, "grupo")} />
          </div>
        </div>
      ) : null}
    </Pagina>
  )
}
