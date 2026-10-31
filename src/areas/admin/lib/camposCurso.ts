import type { CampoDef } from "./campos"
import { opcoesDe, type useOpcoesNivel } from "./opcoes"

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

