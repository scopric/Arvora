import { Link } from "react-router"
import { useCaminho, useT } from "../../../i18n"
import { supabase } from "../../../lib/supabase"
import { CrudTabela } from "../componentes/CrudTabela"
import type { CampoDef } from "../componentes/FormularioRegistro"
import { Mostrar, Pagina } from "../componentes/Pagina"
import { exigir, useCarga } from "../lib/consulta"
import { opcoesDe, useOpcoesNivel } from "../lib/opcoes"
import { EDITA, usePode } from "../lib/papel"

export function camposCurso(verticais: Record<string, unknown>[], niveis: ReturnType<typeof useOpcoesNivel>): CampoDef[] {
  return [
    { chave: "titulo", rotulo: "admin.comum.titulo", tipo: "texto", obrigatorio: true, naTabela: true },
    { chave: "slug", rotulo: "admin.comum.slug", tipo: "texto", slugDe: "titulo", ajuda: "admin.comum.slugAjuda" },
    { chave: "vertical_id", rotulo: "admin.comum.vertical", tipo: "selecao", obrigatorio: true, opcoes: opcoesDe(verticais), naTabela: true },
    { chave: "nivel_minimo", rotulo: "admin.comum.nivelMinimo", tipo: "selecao", obrigatorio: true, opcoes: niveis, naTabela: true },
    { chave: "ordem", rotulo: "admin.comum.ordem", tipo: "numero" },
    { chave: "capa_path", rotulo: "admin.cursos.capa", tipo: "imagem", pasta: "capas" },
    { chave: "descricao", rotulo: "admin.comum.descricao", tipo: "area" },
    { chave: "publicado_em", rotulo: "admin.comum.publicar", tipo: "publicado", naTabela: true },
  ]
}
export const COLUNAS_CURSO = "id, vertical_id, titulo, slug, descricao, capa_path, nivel_minimo, ordem, publicado_em"

export function Cursos() {
  const t = useT()
  const caminho = useCaminho()
  const pode = usePode(EDITA)
  const niveis = useOpcoesNivel()
  const carga = useCarga(async () => exigir(await supabase.from("verticais").select("id, nome").order("ordem")), [])
  return (
    <Pagina titulo="admin.cursos.titulo" intro="admin.cursos.intro">
      <Mostrar carga={carga}>
        {(verticais) => (
          <CrudTabela
            tabela="cursos" colunas={COLUNAS_CURSO} campos={camposCurso(verticais, niveis)} ordem={[{ coluna: "ordem" }, { coluna: "titulo" }]}
            podeEditar={pode} podeApagar legenda="admin.cursos.titulo" vazio="admin.cursos.vazio"
            extra={{ titulo: "admin.cursos.estrutura", celula: (l) => <Link className="underline" to={caminho(`/admin/cursos/${l.id}`)}>{t("admin.cursos.abrir")}</Link> }}
          />
        )}
      </Mostrar>
    </Pagina>
  )
}
