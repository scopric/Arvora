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
import { botaoLink, foco, linkTexto } from "../util"

// Curso: capa, descrição, módulos e aulas com progresso (ACA-01, ACA-03). O nível vale por aula: o Clube vê a amostra
// (aulas de nível Clube) e o cadeado nas demais.
export function Curso() {
  const { curso: slug } = useParams()
  const t = useT()
  const lang = useIdioma()
  const caminho = useCaminho()
  const acesso = useAcesso()
  const { sessao } = useAuth()
  const uid = sessao?.user.id ?? ""
  const [estado, recarregar] = useCarga(() => carregarCurso(slug ?? "", uid), `${slug}:${uid}`)

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

  return (
    <Pagina chave="aprender.curso.titulo" titulo={curso.titulo} rotulo={curso.verticais ? nomeVertical(curso.verticais, lang) : undefined}>
      <Link to={caminho("/academy")} className={`mb-6 inline-block ${linkTexto}`}>‹ {t("aprender.voltarAcademy")}</Link>
      <div className="space-y-8">
        {capa ? <img src={capa} alt="" className="aspect-video w-full max-w-2xl rounded-2xl object-cover" /> : null}
        {curso.descricao ? <p className="max-w-prose text-lg">{curso.descricao}</p> : null}
        {aulas.length ? (
          <div className="flex flex-wrap items-center gap-5">
            <label className="flex items-center gap-3 text-sm">
              <span>{feitas} {t("aprender.curso.de")} {aulas.length} {t("aprender.curso.aulasConcluidas")}</span>
              <progress value={feitas} max={aulas.length} className="h-2 w-40 accent-destaque" />
            </label>
            {continuar ? (
              <Link to={caminho(`/academy/${curso.slug}/${continuar.slug}`)} className={botaoLink}>
                {progresso.has(continuar.id) ? t("aprender.curso.continuar") : t("aprender.curso.comecar")}
              </Link>
            ) : null}
          </div>
        ) : null}
        {ordenadas.length === 0 ? (
          <Vazio>{t("aprender.curso.vazio")}</Vazio>
        ) : (
          ordenadas.map(({ modulo, itens }) => (
            <section key={modulo.id}>
              <h2 className="text-corpo-g font-semibold">{modulo.titulo}</h2>
              <ol className="mt-3 divide-y divide-current/15 rounded-2xl border border-current/15">
                {itens.map((a) => {
                  const livre = temNivel(acesso.nivel, a.nivel_minimo)
                  const pct = progresso.get(a.id) ?? 0
                  return (
                    <li key={a.id}>
                      <Link to={caminho(`/academy/${curso.slug}/${a.slug}`)} className={`flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-creme/5 ${foco}`}>
                        <span className="flex-1">{a.titulo}</span>
                        {!livre ? (
                          <>
                            <Icone nome="cadeado" className="size-4" />
                            <span className="sr-only">{t("bloqueado.rotulo")}</span>
                          </>
                        ) : pct === 100 ? (
                          <span className="text-sm text-destaque">{t("aprender.assistida")}</span>
                        ) : pct > 0 ? (
                          <span className="text-sm opacity-75">{pct}%</span>
                        ) : null}
                        {a.duracao_min ? <span className="text-sm opacity-75">{a.duracao_min} {t("aprender.min")}</span> : null}
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
