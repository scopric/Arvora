import { useState } from "react"
import { Link } from "react-router"
import { Selecao } from "../../../componentes/Campo"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { Icone } from "../../../componentes/Icone"
import { Vazio } from "../../../componentes/Vazio"
import { useCaminho, useIdioma, useT } from "../../../i18n"
import { temNivel, useAcesso } from "../../../lib/acesso"
import { supabase } from "../../../lib/supabase"
import { COLUNAS_CURSO, urlCapa, type CursoLinha } from "../curso"
import { Pagina } from "../componentes/Pagina"
import { nomeVertical } from "../tipos"
import { useCarga } from "../useCarga"
import { dados, foco } from "../util"

// Catálogo (ACA-01): cursos publicados, filtro por trilha. O Clube vê todos; o cadeado marca o que é do Grupo.
// Molde MasterClass (library): filtros à esquerda, grade de capas 16:9 sem moldura, nome do curso em Big Shoulders.
export function Academy() {
  const t = useT()
  const lang = useIdioma()
  const caminho = useCaminho()
  const acesso = useAcesso()
  const [trilha, setTrilha] = useState("")
  const [estado, recarregar] = useCarga(async () => dados(await supabase.from("cursos").select(COLUNAS_CURSO).order("ordem")) as unknown as CursoLinha[], "cursos")

  if (acesso.carregando || estado.fase === "carregando") return <Pagina chave="aprender.academy.titulo"><Esqueleto linhas={6} /></Pagina>
  if (acesso.erro) return <Pagina chave="aprender.academy.titulo"><Erro aoTentar={acesso.recarregar}>{t("acesso.erro")}</Erro></Pagina>
  if (estado.fase === "erro") return <Pagina chave="aprender.academy.titulo"><Erro aoTentar={recarregar} /></Pagina>

  const trilhas = [...new Map(estado.dados.filter((c) => c.verticais).map((c) => [c.vertical_id, c.verticais!])).entries()]
  const cursos = estado.dados.filter((c) => !trilha || c.vertical_id === Number(trilha))
  const filtro = trilhas.length > 1
  return (
    <Pagina chave="aprender.academy.titulo">
      <div className={filtro ? "grid gap-8 lg:grid-cols-[14rem_1fr]" : ""}>
        {filtro ? (
          <div className="lg:sticky lg:top-16 lg:self-start">
            <Selecao rotulo={t("aprender.academy.trilha")} value={trilha} onChange={(e) => setTrilha(e.target.value)}>
              <option value="">{t("aprender.aulas.todas")}</option>
              {trilhas.map(([id, v]) => (
                <option key={id} value={id}>{nomeVertical(v, lang)}</option>
              ))}
            </Selecao>
          </div>
        ) : null}
        {cursos.length === 0 ? (
          <Vazio>{t("aprender.academy.vazio")}</Vazio>
        ) : (
          <ul className={`grid gap-x-5 gap-y-8 sm:grid-cols-2 ${filtro ? "xl:grid-cols-3" : "lg:grid-cols-3"}`}>
            {cursos.map((c) => {
              const bloqueado = !temNivel(acesso.nivel, c.nivel_minimo)
              const capa = urlCapa(c.capa_path)
              return (
                <li key={c.id} className="group relative">
                  {capa ? (
                    <img src={capa} alt="" loading="lazy" className="aspect-video w-full rounded-md object-cover" />
                  ) : (
                    <div aria-hidden="true" className="flex aspect-video w-full items-center justify-center rounded-md bg-fumaca text-cinza">
                      <Icone nome="aprender" className="size-8" />
                    </div>
                  )}
                  <p className="mt-3 flex items-center gap-2 text-legenda text-nevoa">
                    {c.verticais ? <span>{nomeVertical(c.verticais, lang)}</span> : null}
                    {bloqueado ? (
                      <span className="flex items-center gap-1">
                        {c.verticais ? <span aria-hidden="true">·</span> : null}
                        <Icone nome="cadeado" className="size-3.5" />
                        {t("aprender.academy.parteGrupo")}
                      </span>
                    ) : null}
                  </p>
                  <h2 className="mt-1 font-conteudo text-subtitulo leading-none font-normal tracking-normal">
                    <Link to={caminho(`/academy/${c.slug}`)} className={`rounded-sm underline-offset-4 group-hover:underline after:absolute after:inset-0 ${foco}`}>{c.titulo}</Link>
                  </h2>
                  {c.descricao ? <p className="mt-1.5 line-clamp-2 text-legenda text-nevoa">{c.descricao}</p> : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Pagina>
  )
}
