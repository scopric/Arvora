import { useState } from "react"
import { Link } from "react-router"
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
// Molde MasterClass (telas 5ef9a9fb e 4b456354, no cofre): fileira de tiles de categoria (as trilhas) com ícone, a ativa
// com anel dourado; grade de 3 colunas com capa 16:9 sem moldura, meta em cinza, título 24/600 e descrição.
// Não há painel "Filtros": a única dimensão de filtro que o banco oferece é a trilha, que já está nos tiles.
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
  const tile = `flex min-h-24 min-w-32 flex-col items-center justify-center gap-2 rounded-lg px-4 text-center text-corpo font-semibold text-cinza transition-colors vidro-fundo hover:text-creme aria-pressed:text-creme aria-pressed:ring-1 aria-pressed:ring-dourado aria-pressed:ring-inset ${foco}`
  return (
    <Pagina chave="aprender.academy.titulo">
      <div className="space-y-10">
        {trilhas.length > 1 ? (
          <div role="group" aria-label={t("aprender.academy.trilha")} className="flex gap-3 overflow-x-auto pb-1">
            <button type="button" aria-pressed={trilha === ""} onClick={() => setTrilha("")} className={tile}>
              <Icone nome="camadas" className="size-6" />
              {t("aprender.aulas.todas")}
            </button>
            {trilhas.map(([id, v]) => (
              <button key={id} type="button" aria-pressed={trilha === String(id)} onClick={() => setTrilha(String(id))} className={tile}>
                <Icone nome="aprender" className="size-6" />
                {nomeVertical(v, lang)}
              </button>
            ))}
          </div>
        ) : null}
        {cursos.length === 0 ? (
          <Vazio>{t("aprender.academy.vazio")}</Vazio>
        ) : (
          <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {cursos.map((c) => {
              const bloqueado = !temNivel(acesso.nivel, c.nivel_minimo)
              const capa = urlCapa(c.capa_path)
              return (
                <li key={c.id} className="group relative">
                  {capa ? (
                    <img src={capa} alt="" loading="lazy" className="aspect-video w-full rounded-lg object-cover" />
                  ) : (
                    <div aria-hidden="true" className="flex aspect-video w-full items-center justify-center rounded-lg text-cinza vidro-fundo">
                      <Icone nome="aprender" className="size-8" />
                    </div>
                  )}
                  <p className="mt-4 flex flex-wrap items-center gap-2 text-corpo-p text-cinza">
                    {c.verticais ? <span>{nomeVertical(c.verticais, lang)}</span> : null}
                    {bloqueado ? (
                      <span className="flex items-center gap-1">
                        {c.verticais ? <span aria-hidden="true">·</span> : null}
                        <Icone nome="cadeado" className="size-3.5" />
                        {t("aprender.academy.parteGrupo")}
                      </span>
                    ) : null}
                  </p>
                  <h2 className="mt-1 text-titulo-p font-semibold">
                    <Link to={caminho(`/academy/${c.slug}`)} className={`rounded-sm underline-offset-4 group-hover:underline after:absolute after:inset-0 ${foco}`}>{c.titulo}</Link>
                  </h2>
                  {c.descricao ? <p className="mt-1.5 line-clamp-2 text-corpo text-cinza">{c.descricao}</p> : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Pagina>
  )
}
