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
  return (
    <Pagina chave="aprender.academy.titulo">
      <div className="space-y-8">
        {trilhas.length > 1 ? (
          <div className="max-w-xs">
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
          <ul className="grid gap-5 sm:grid-cols-2">
            {cursos.map((c) => {
              const bloqueado = !temNivel(acesso.nivel, c.nivel_minimo)
              const capa = urlCapa(c.capa_path)
              return (
                <li key={c.id} className="overflow-hidden rounded-2xl border border-current/15 bg-superficie/25">
                  {capa ? <img src={capa} alt="" loading="lazy" className="aspect-video w-full object-cover" /> : null}
                  <div className="space-y-2 p-5">
                    {c.verticais ? <p className="font-mono text-xs font-semibold tracking-[0.2em] text-destaque uppercase">{nomeVertical(c.verticais, lang)}</p> : null}
                    <h2 className="text-xl font-semibold">
                      <Link to={caminho(`/academy/${c.slug}`)} className={`underline-offset-4 hover:underline ${foco}`}>{c.titulo}</Link>
                    </h2>
                    {c.descricao ? <p className="line-clamp-3 text-sm opacity-80">{c.descricao}</p> : null}
                    {bloqueado ? (
                      <p className="flex items-center gap-2 text-sm text-destaque">
                        <Icone nome="cadeado" className="size-4" />
                        {t("aprender.academy.parteGrupo")}
                      </p>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Pagina>
  )
}
