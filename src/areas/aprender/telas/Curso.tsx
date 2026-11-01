import { Link, useParams } from "react-router"
import { Bloqueado } from "../../../componentes/Bloqueado"
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
import { barraProgresso, botaoContorno, botaoLink, foco, linkTexto } from "../util"

// Curso: capa, descrição, módulos e aulas com progresso (ACA-01, ACA-03). O nível vale por aula: o Clube vê a amostra
// (aulas de nível Clube) e o cadeado nas demais. Molde MasterClass (página da classe): herói com capa + título + CTA,
// aulas em linhas numeradas com duração e estado.
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
  const capa = urlCapa(curso.capa_path)
  const ordenadas = modulos.map((m) => ({ modulo: m, itens: aulas.filter((a) => a.modulo_id === m.id) }))
  let numero = 0

  return (
    <Pagina chave="aprender.curso.titulo" titulo={curso.titulo} conteudo rotulo={curso.verticais ? nomeVertical(curso.verticais, lang) : undefined} voltar={voltar}>
      <div className="space-y-10">
        <div className={capa ? "grid gap-6 lg:grid-cols-[minmax(0,24rem)_1fr] lg:items-start" : ""}>
          {capa ? <img src={capa} alt="" className="aspect-video w-full rounded-xl object-cover" /> : null}
          <div className="space-y-5">
            {curso.descricao ? <p className="max-w-prose text-base text-bruma">{curso.descricao}</p> : null}
            {aulas.length ? (
              <div className="flex flex-wrap items-center gap-5">
                {continuar ? (
                  <Link to={caminho(`/academy/${curso.slug}/${continuar.slug}`)} className={algumBloqueio ? botaoContorno : botaoLink}>
                    {progresso.has(continuar.id) ? t("aprender.curso.continuar") : t("aprender.curso.comecar")}
                  </Link>
                ) : null}
                <label className="flex items-center gap-3 text-legenda text-nevoa">
                  <progress value={feitas} max={aulas.length} className={barraProgresso} />
                  <span className="tabular-nums">{feitas} {t("aprender.curso.de")} {aulas.length} {t("aprender.curso.aulasConcluidas")}</span>
                </label>
              </div>
            ) : null}
          </div>
        </div>
        {ordenadas.length === 0 ? (
          <Vazio>{t("aprender.curso.vazio")}</Vazio>
        ) : (
          ordenadas.map(({ modulo, itens }) => (
            <section key={modulo.id}>
              <h2 className="text-corpo-g font-semibold">{modulo.titulo}</h2>
              <ol className="mt-3 divide-y divide-grafite rounded-xl shadow-borda">
                {itens.map((a) => {
                  const livre = temNivel(acesso.nivel, a.nivel_minimo)
                  const pct = progresso.get(a.id) ?? 0
                  numero += 1
                  return (
                    <li key={a.id}>
                      <Link to={caminho(`/academy/${curso.slug}/${a.slug}`)} className={`flex min-h-12 items-center gap-3 px-4 py-2.5 transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-creme/2 ${foco}`}>
                        <span className="w-6 shrink-0 text-legenda text-nevoa tabular-nums">{numero}</span>
                        <span className="flex-1 text-base">{a.titulo}</span>
                        {!livre ? (
                          <>
                            <Icone nome="cadeado" className="size-4 text-cinza" />
                            <span className="sr-only">{t("bloqueado.rotulo")}</span>
                          </>
                        ) : pct === 100 ? (
                          <span className="text-legenda text-destaque">{t("aprender.assistida")}</span>
                        ) : pct > 0 ? (
                          <span className="text-legenda text-nevoa tabular-nums">{pct}%</span>
                        ) : null}
                        {a.duracao_min ? <span className="text-legenda text-nevoa tabular-nums">{a.duracao_min} {t("aprender.min")}</span> : null}
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
