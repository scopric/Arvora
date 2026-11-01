import { useState } from "react"
import { Link, useParams } from "react-router"
import { Bloqueado } from "../../../componentes/Bloqueado"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { Icone } from "../../../componentes/Icone"
import { linkListaApp, rotuloGrupoApp } from "../../../componentes/menuApp"
import { useCaminho, useT } from "../../../i18n"
import { temNivel, useAcesso } from "../../../lib/acesso"
import { useAuth } from "../../../lib/sessao"
import { carregarCurso } from "../curso"
import { Gravacao } from "../componentes/Gravacao"
import { Pagina } from "../componentes/Pagina"
import { useCarga } from "../useCarga"
import { linkTexto } from "../util"

// Player do curso (ACA-02, ACA-03): vídeo à esquerda, lista de aulas à direita, retoma de onde parou e grava o progresso.
// Molde MasterClass (lição): player largo, título em Big Shoulders, painel direito com as aulas do curso (no celular, abaixo).
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
    <Pagina chave={chave} titulo={aula.titulo} conteudo rotulo={curso.titulo} voltar={{ para: caminho(`/academy/${curso.slug}`), rotulo: curso.titulo }}>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          {permitido ? (
            <>
              <Gravacao key={aula.id} aulaId={aula.id} titulo={aula.titulo} uid={uid} aoMudarPercentual={(p) => setLocal((l) => ({ ...l, [aula.id]: p }))} />
              {aula.descricao ? <p className="max-w-prose text-base text-bruma">{aula.descricao}</p> : null}
              {seguinte ? (
                <p>
                  <Link to={caminho(`/academy/${curso.slug}/${seguinte.slug}`)} className={linkTexto}>{t("aprender.proxima")}: {seguinte.titulo} <span aria-hidden="true">→</span></Link>
                </p>
              ) : null}
            </>
          ) : (
            <Bloqueado previa={<p className="text-base">{aula.descricao ?? aula.titulo}</p>} frase={t("aprender.academy.continuaNoGrupo")} />
          )}
        </div>
        <nav aria-label={t("aprender.curso.lista")} className="rounded-xl p-2 shadow-borda lg:sticky lg:top-6 lg:self-start">
          {modulos.map((m) => (
            <section key={m.id}>
              <h2 className={rotuloGrupoApp}>{m.titulo}</h2>
              <ol>
                {aulas.filter((a) => a.modulo_id === m.id).map((a) => (
                  <li key={a.id}>
                    <Link to={caminho(`/academy/${curso.slug}/${a.slug}`)} aria-current={a.id === aula.id ? "page" : undefined} className={linkListaApp}>
                      <span className="flex-1">{a.titulo}</span>
                      {!temNivel(acesso.nivel, a.nivel_minimo) ? (
                        <>
                          <Icone nome="cadeado" className="size-3.5 shrink-0 text-cinza" />
                          <span className="sr-only">{t("bloqueado.rotulo")}</span>
                        </>
                      ) : pct(a.id) === 100 ? (
                        <span className="text-xs text-destaque">{t("aprender.assistida")}</span>
                      ) : pct(a.id) > 0 ? (
                        <span className="text-xs tabular-nums">{pct(a.id)}%</span>
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
