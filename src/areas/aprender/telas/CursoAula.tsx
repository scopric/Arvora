import { useState } from "react"
import { Link, useParams } from "react-router"
import { Bloqueado } from "../../../componentes/Bloqueado"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { Icone } from "../../../componentes/Icone"
import { useCaminho, useT } from "../../../i18n"
import { temNivel, useAcesso } from "../../../lib/acesso"
import { useAuth } from "../../../lib/sessao"
import { carregarCurso } from "../curso"
import { Gravacao } from "../componentes/Gravacao"
import { Pagina } from "../componentes/Pagina"
import { useCarga } from "../useCarga"
import { foco, linkTexto } from "../util"

// Player do curso (ACA-02, ACA-03): vídeo à esquerda, lista de aulas à direita, retoma de onde parou e grava o progresso.
export function CursoAula() {
  const { curso: slugCurso, aula: slugAula } = useParams()
  const t = useT()
  const caminho = useCaminho()
  const acesso = useAcesso()
  const { sessao } = useAuth()
  const uid = sessao?.user.id ?? ""
  const [estado, recarregar] = useCarga(() => carregarCurso(slugCurso ?? "", uid), `${slugCurso}:${uid}`)
  const [local, setLocal] = useState<Record<number, number>>({}) // percentuais novos desta visita, para a lista lateral

  const chave = "aprender.cursoAula.titulo"
  if (acesso.carregando || estado.fase === "carregando") return <Pagina chave={chave}><Esqueleto linhas={6} /></Pagina>
  if (acesso.erro) return <Pagina chave={chave}><Erro aoTentar={acesso.recarregar}>{t("acesso.erro")}</Erro></Pagina>
  if (estado.fase === "erro") return <Pagina chave={chave}><Erro aoTentar={recarregar} /></Pagina>
  const aula = estado.dados?.aulas.find((a) => a.slug === slugAula)
  if (!estado.dados || !aula)
    return (
      <Pagina chave={chave} titulo={t("aprender.naoEncontrada")}>
        <Link to={caminho("/academy")} className={linkTexto}>{t("aprender.voltarAcademy")}</Link>
      </Pagina>
    )

  const { curso, modulos, aulas, progresso } = estado.dados
  const pct = (id: number) => local[id] ?? progresso.get(id) ?? 0
  const indice = aulas.findIndex((a) => a.id === aula.id)
  const seguinte = aulas.slice(indice + 1).find((a) => temNivel(acesso.nivel, a.nivel_minimo))
  const permitido = temNivel(acesso.nivel, aula.nivel_minimo)

  return (
    <Pagina chave={chave} titulo={aula.titulo} rotulo={curso.titulo}>
      <Link to={caminho(`/academy/${curso.slug}`)} className={`mb-6 inline-block ${linkTexto}`}>‹ {curso.titulo}</Link>
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          {permitido ? (
            <>
              {aula.descricao ? <p className="max-w-prose text-lg">{aula.descricao}</p> : null}
              <Gravacao key={aula.id} aulaId={aula.id} titulo={aula.titulo} uid={uid} aoMudarPercentual={(p) => setLocal((l) => ({ ...l, [aula.id]: p }))} />
              {seguinte ? (
                <p>
                  <Link to={caminho(`/academy/${curso.slug}/${seguinte.slug}`)} className={linkTexto}>{t("aprender.proxima")}: {seguinte.titulo} →</Link>
                </p>
              ) : null}
            </>
          ) : (
            <Bloqueado previa={<p className="text-lg">{aula.descricao ?? aula.titulo}</p>} frase={t("aprender.academy.continuaNoGrupo")} />
          )}
        </div>
        <nav aria-label={t("aprender.curso.lista")} className="space-y-5">
          {modulos.map((m) => (
            <section key={m.id}>
              <h2 className="text-sm font-semibold tracking-wide uppercase opacity-75">{m.titulo}</h2>
              <ol className="mt-2 space-y-1">
                {aulas.filter((a) => a.modulo_id === m.id).map((a) => (
                  <li key={a.id}>
                    <Link
                      to={caminho(`/academy/${curso.slug}/${a.slug}`)}
                      aria-current={a.id === aula.id ? "page" : undefined}
                      className={`flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 hover:bg-creme/10 aria-[current=page]:bg-creme/15 ${foco}`}
                    >
                      <span className="flex-1">{a.titulo}</span>
                      {!temNivel(acesso.nivel, a.nivel_minimo) ? (
                        <>
                          <Icone nome="cadeado" className="size-4" />
                          <span className="sr-only">{t("bloqueado.rotulo")}</span>
                        </>
                      ) : pct(a.id) === 100 ? (
                        <span className="text-sm text-destaque">{t("aprender.assistida")}</span>
                      ) : pct(a.id) > 0 ? (
                        <span className="text-sm opacity-75">{pct(a.id)}%</span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </nav>
      </div>
    </Pagina>
  )
}
