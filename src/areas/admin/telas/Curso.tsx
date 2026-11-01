import { Link, useParams } from "react-router"
import { Selo } from "../../../componentes/Selo"
import { Vazio } from "../../../componentes/Vazio"
import { useCaminho, useT } from "../../../i18n"
import { supabase } from "../../../lib/supabase"
import { CrudTabela } from "../componentes/CrudTabela"
import type { CampoDef } from "../componentes/FormularioRegistro"
import { Mostrar, Pagina, Secao } from "../componentes/Pagina"
import { exigir, exigirLinha, useCarga } from "../lib/consulta"
import { EDITA, usePode } from "../lib/papel"
import { FormularioRegistro } from "../componentes/FormularioRegistro"
import { COLUNAS_CURSO, camposCurso } from "../lib/camposCurso"
import { useOpcoesNivel } from "../lib/opcoes"
import { estadoAula } from "../lib/regras"
import { classeLink } from "../lib/estilo"

const MODULO: CampoDef[] = [
  { chave: "titulo", rotulo: "admin.comum.titulo", tipo: "texto", obrigatorio: true, naTabela: true },
  { chave: "ordem", rotulo: "admin.comum.ordem", tipo: "numero", obrigatorio: true, naTabela: true },
]

// Curso → módulos → aulas (PRD ACA-05). Aula nova e mudança de módulo saem do formulário da aula.
export function Curso() {
  const t = useT()
  const caminho = useCaminho()
  const { id = "" } = useParams()
  const pode = usePode(EDITA)
  const niveis = useOpcoesNivel()
  const carga = useCarga(async () => {
    const [curso, verticais, modulos, aulas] = await Promise.all([
      supabase.from("cursos").select(COLUNAS_CURSO).eq("id", Number(id)).maybeSingle(),
      supabase.from("verticais").select("id, nome").order("ordem"),
      supabase.from("modulos").select("id, titulo, ordem").eq("curso_id", Number(id)).order("ordem"),
      supabase.from("aulas").select("id, modulo_id, titulo, ordem, agendada_em, materiais_publicados_em").order("ordem"),
    ])
    const c = exigir(curso)
    const ms = exigir(modulos)
    const ids = new Set(ms.map((m) => m.id))
    return { curso: c, verticais: exigir(verticais), modulos: ms, aulas: exigir(aulas).filter((a) => a.modulo_id !== null && ids.has(a.modulo_id)) }
  }, [id])

  return (
    <Pagina titulo="admin.curso.titulo" voltar={{ para: caminho("/admin/cursos"), rotulo: t("admin.comum.voltar") }}>
      <Mostrar carga={carga}>
        {(d) => (
          <>
            <Secao titulo="admin.curso.dados">
              {pode ? (
                <FormularioRegistro
                  campos={camposCurso(d.verticais, niveis)} linha={d.curso}
                  aoSalvar={async (c) => exigirLinha(await supabase.from("cursos").update(c as never).eq("id", d.curso.id).select("id"))}
                />
              ) : (
                <p>{d.curso.titulo}</p>
              )}
            </Secao>
            <Secao titulo="admin.curso.modulos">
              <CrudTabela
                variante="contorno"
                tabela="modulos" colunas="id, curso_id, titulo, ordem" campos={MODULO} ordem={[{ coluna: "ordem" }]} filtro={{ coluna: "curso_id", valor: d.curso.id }}
                fixos={{ curso_id: d.curso.id }} podeEditar={pode} podeApagar legenda="admin.curso.modulos" vazio="admin.curso.semModulos" aoMudar={carga.recarregar}
              />
            </Secao>
            <Secao titulo="admin.curso.aulas">
              {d.modulos.length === 0 ? <Vazio>{t("admin.curso.semModulos")}</Vazio> : d.modulos.map((m) => (
                <div key={m.id} className="mb-4">
                  <h3 className="text-base font-semibold">{m.titulo}</h3>
                  <ul className="mt-2 space-y-1">
                    {d.aulas.filter((a) => a.modulo_id === m.id).map((a) => (
                      <li key={a.id} className="flex items-center gap-3">
                        <Link className={classeLink} to={caminho(`/admin/aulas/${a.id}`)}>{a.titulo}</Link>
                        <Selo>{t(`admin.aulas.estado.${estadoAula(a)}`)}</Selo>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </Secao>
          </>
        )}
      </Mostrar>
    </Pagina>
  )
}
