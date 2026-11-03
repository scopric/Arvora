import { Link, useParams } from "react-router"
import { Bloqueado } from "../../../componentes/Bloqueado"
import { botaoPrimarioApp } from "../../../componentes/botaoEstilo"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { Icone } from "../../../componentes/Icone"
import { Vazio } from "../../../componentes/Vazio"
import { useCaminho, useIdioma, useT } from "../../../i18n"
import { temNivel, useAcesso } from "../../../lib/acesso"
import { useAuth } from "../../../lib/sessao"
import { carregarCurso, urlCapa } from "../curso"
import { Pagina } from "../componentes/Pagina"
import { nomeVertical } from "../tipos"
import { useCarga } from "../useCarga"
import { barraProgresso, linkTexto, miniaturaAula, pilulaDuracao } from "../util"

// Curso: capa, descrição, módulos e aulas com progresso (ACA-01, ACA-03). O nível vale por aula: o Clube vê a amostra
// (aulas de nível Clube) e o cadeado nas demais. Molde MasterClass (página da classe, tela 20a079e8 no cofre): herói
// com a capa atrás do nome em Big Shoulders, traço dourado, CTA único; aulas numeradas com miniatura, duração em
// pílula, título e resumo.
export function Curso() {
  const { curso: slug } = useParams()
  const t = useT()
  const lang = useIdioma()
  const caminho = useCaminho()
  const acesso = useAcesso()
  const { sessao } = useAuth()
  const uid = sessao?.user.id ?? ""
  const [estado, recarregar] = useCarga(() => carregarCurso(slug ?? "", uid), `${slug}:${uid}`)
  const voltar = { para: caminho("/academy"), rotulo: t("aprender.voltarAcademy") }

  if (acesso.carregando || estado.fase === "carregando") return <Pagina chave="aprender.curso.titulo"><Esqueleto linhas={6} /></Pagina>
  if (acesso.erro) return <Pagina chave="aprender.curso.titulo"><Erro aoTentar={acesso.recarregar}>{t("acesso.erro")}</Erro></Pagina>
  if (estado.fase === "erro") return <Pagina chave="aprender.curso.titulo"><Erro aoTentar={recarregar} /></Pagina>
  if (!estado.dados)
    return (
      <Pagina chave="aprender.curso.titulo" titulo={t("aprender.naoEncontrada")}>
        <Link to={caminho("/academy")} className={linkTexto}>{t("aprender.voltarAcademy")}</Link>
      </Pagina>
    )

  const { curso, modulos, aulas, progresso } = estado.dados
  const feitas = aulas.filter((a) => progresso.get(a.id) === 100).length
  const algumBloqueio = aulas.some((a) => !temNivel(acesso.nivel, a.nivel_minimo))
  // "Continuar": a primeira aula liberada que ainda não terminou (começa pela primeira, se nada foi visto).
  const continuar = aulas.find((a) => temNivel(acesso.nivel, a.nivel_minimo) && progresso.get(a.id) !== 100)
  const ordenadas = modulos.map((m) => ({ modulo: m, itens: aulas.filter((a) => a.modulo_id === m.id) }))
  let numero = 0

  return (
    <Pagina
      chave="aprender.curso.titulo"
      titulo={curso.titulo}
      conteudo
      capa={urlCapa(curso.capa_path)}
      rotulo={curso.verticais ? nomeVertical(curso.verticais, lang) : undefined}
      intro={curso.descricao ?? undefined}
      voltar={voltar}
      acoes={
        aulas.length ? (
          <div className="flex flex-wrap items-center gap-5">
            {continuar ? (
              <Link to={caminho(`/academy/${curso.slug}/${continuar.slug}`)} className={botaoPrimarioApp}>
                {progresso.has(continuar.id) ? t("aprender.curso.continuar") : t("aprender.curso.comecar")}
              </Link>
            ) : null}
            <label className="flex items-center gap-3 text-corpo-p text-cinza">
              <progress value={feitas} max={aulas.length} className={barraProgresso} />
              <span className="tabular-nums">{feitas} {t("aprender.curso.de")} {aulas.length} {t("aprender.curso.aulasConcluidas")}</span>
            </label>
          </div>
        ) : undefined
      }
    >
      <div className="max-w-4xl space-y-10">
        {ordenadas.length === 0 ? (
          <Vazio>{t("aprender.curso.vazio")}</Vazio>
        ) : (
          ordenadas.map(({ modulo, itens }) => (
            <section key={modulo.id}>
              <h2 className="text-subtitulo font-semibold">{modulo.titulo}</h2>
              <ol className="mt-4 divide-y divide-placa">
                {itens.map((a) => {
                  const livre = temNivel(acesso.nivel, a.nivel_minimo)
                  const pct = progresso.get(a.id) ?? 0
                  numero += 1
                  return (
                    <li key={a.id}>
                      <Link to={caminho(`/academy/${curso.slug}/${a.slug}`)} className={`flex items-center gap-4 rounded-lg py-3 transition-colors hover:bg-creme/3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-dourado sm:gap-5`}>
                        <span aria-hidden="true" className={miniaturaAula}>
                          <span>{numero}</span>
                          {a.duracao_min ? <span className={pilulaDuracao}>{a.duracao_min} {t("aprender.min")}</span> : null}
                          {pct === 100 ? <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 rounded-b-lg bg-dourado" /> : pct > 0 ? <span aria-hidden="true" className="absolute bottom-0 left-0 h-0.5 rounded-bl-lg bg-dourado" style={{ width: `${pct}%` }} /> : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-subtitulo font-semibold">{numero}. {a.titulo}{a.duracao_min ? <> <span className="sr-only">({a.duracao_min} {t("aprender.min")})</span></> : null}</span>
                          {a.descricao ? <span className="mt-1 line-clamp-2 block text-corpo text-cinza">{a.descricao}</span> : null}
                        </span>
                        {!livre ? (
                          <>
                            <Icone nome="cadeado" className="size-4 shrink-0 text-cinza" />
                            {" "}
                            <span className="sr-only">{t("bloqueado.rotulo")}</span>
                          </>
                        ) : pct === 100 ? (
                          <span className="shrink-0 text-corpo-p text-destaque">{t("aprender.assistida")}</span>
                        ) : pct > 0 ? (
                          <span className="shrink-0 text-corpo-p text-cinza tabular-nums">{pct}%</span>
                        ) : null}
                      </Link>
                    </li>
                  )
                })}
              </ol>
            </section>
          ))
        )}
        {algumBloqueio ? <Bloqueado frase={t("aprender.academy.continuaNoGrupo")} /> : null}
      </div>
    </Pagina>
  )
}
