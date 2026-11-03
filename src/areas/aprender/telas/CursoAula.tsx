import { useState } from "react"
import { Link, useParams } from "react-router"
import { Bloqueado } from "../../../componentes/Bloqueado"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { Icone } from "../../../componentes/Icone"
import { LinkVoltar } from "../../../componentes/LinkVoltar"
import { MolduraApp } from "../../../componentes/PaginaApp"
import { useCaminho, useT } from "../../../i18n"
import { temNivel, useAcesso } from "../../../lib/acesso"
import { useAuth } from "../../../lib/sessao"
import { carregarCurso, urlCapa } from "../curso"
import { Gravacao } from "../componentes/Gravacao"
import { Pagina } from "../componentes/Pagina"
import { useCarga } from "../useCarga"
import { foco, linkTexto, miniaturaAula } from "../util"

// Player do curso (ACA-02, ACA-03): vídeo à esquerda, lista de aulas à direita, retoma de onde parou e grava o progresso.
// Molde MasterClass (lição, telas 93622e8c e 3c27fa73): player largo; abaixo, "N. Título" em 24/600 com a
// descrição e as ações; painel de vidro à direita com a capa e o nome do curso, a contagem de aulas e a lista com
// miniatura, duração em pílula e a aula atual marcada (no celular, abaixo do player).
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
  const feitas = aulas.filter((a) => pct(a.id) === 100).length
  const capa = urlCapa(curso.capa_path)

  return (
    <MolduraApp chave={chave}>
      <LinkVoltar para={caminho(`/academy/${curso.slug}`)} rotulo={curso.titulo} />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          {permitido ? (
            <Gravacao key={aula.id} aulaId={aula.id} titulo={aula.titulo} uid={uid} aoMudarPercentual={(p) => setLocal((l) => ({ ...l, [aula.id]: p }))}>
              <h1 className="text-titulo-p font-semibold">{indice + 1}. {aula.titulo}</h1>
              {aula.descricao ? <p className="mt-2 max-w-prose text-corpo text-cinza">{aula.descricao}</p> : null}
            </Gravacao>
          ) : (
            <>
              <h1 className="text-titulo-p font-semibold">{indice + 1}. {aula.titulo}</h1>
              <Bloqueado previa={<p className="text-corpo">{aula.descricao ?? aula.titulo}</p>} frase={t("aprender.academy.continuaNoGrupo")} />
            </>
          )}
          {permitido && seguinte ? (
            <p>
              <Link to={caminho(`/academy/${curso.slug}/${seguinte.slug}`)} className={linkTexto}>{t("aprender.proxima")}: {seguinte.titulo} <span aria-hidden="true">→</span></Link>
            </p>
          ) : null}
        </div>
        <nav aria-label={t("aprender.curso.lista")} className="rounded-lg p-3 vidro lg:sticky lg:top-24 lg:self-start">
          <div className="flex items-center gap-3 px-2 pt-1 pb-3">
            {capa ? <img src={capa} alt="" className="aspect-video w-20 rounded-lg object-cover" /> : null}
            <div className="min-w-0">
              <p className="truncate text-corpo font-semibold">{curso.titulo}</p>
              <p className="text-corpo-p text-cinza tabular-nums">{feitas} {t("aprender.curso.de")} {aulas.length} {t("aprender.curso.aulasConcluidas")}</p>
            </div>
          </div>
          {modulos.map((m) => (
            <section key={m.id} className="border-t border-fumaca pt-2">
              <h2 className="px-2 pt-2 pb-1 text-corpo-p font-semibold text-cinza">{m.titulo}</h2>
              <ol className="space-y-1">
                {aulas.filter((a) => a.modulo_id === m.id).map((a) => {
                  const numero = aulas.indexOf(a) + 1
                  const atual = a.id === aula.id
                  const livre = temNivel(acesso.nivel, a.nivel_minimo)
                  return (
                    <li key={a.id}>
                      <Link to={caminho(`/academy/${curso.slug}/${a.slug}`)} aria-current={atual ? "page" : undefined} className={`relative flex items-center gap-3 rounded-lg p-2 text-corpo-p font-semibold text-cinza transition-colors hover:bg-fumaca/30 hover:text-creme aria-[current=page]:bg-fumaca/50 aria-[current=page]:text-creme aria-[current=page]:before:absolute aria-[current=page]:before:inset-y-3 aria-[current=page]:before:left-0 aria-[current=page]:before:w-0.5 aria-[current=page]:before:rounded-full aria-[current=page]:before:bg-dourado ${foco}`}>
                        <span aria-hidden="true" data-n={numero} className={`${miniaturaAula} w-20 text-corpo before:content-[attr(data-n)] sm:w-20`}>
                          {pct(a.id) > 0 ? <span aria-hidden="true" className="absolute bottom-0 left-0 h-0.5 rounded-bl-lg bg-dourado" style={{ width: `${pct(a.id)}%` }} /> : null}
                        </span>
                        <span className="min-w-0 flex-1"><span className="sr-only">{numero}.</span> {a.titulo}</span>
                        {!livre ? (
                          <>
                            <Icone nome="cadeado" className="size-3.5 shrink-0 text-cinza" />
                            {" "}
                            <span className="sr-only">{t("bloqueado.rotulo")}</span>
                          </>
                        ) : pct(a.id) === 100 ? (
                          <span className="shrink-0 text-corpo-p text-destaque">{t("aprender.assistida")}</span>
                        ) : pct(a.id) > 0 ? (
                          <span className="shrink-0 text-corpo-p tabular-nums">{pct(a.id)}%</span>
                        ) : null}
                      </Link>
                    </li>
                  )
                })}
              </ol>
            </section>
          ))}
        </nav>
      </div>
    </MolduraApp>
  )
}
