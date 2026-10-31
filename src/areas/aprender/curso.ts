import { supabase } from "../../lib/supabase"
import { COLUNAS_AULA, type AulaLinha, type Vertical } from "./tipos"
import { dados } from "./util"

export type CursoLinha = { id: number; slug: string; titulo: string; descricao: string | null; capa_path: string | null; nivel_minimo: "clube" | "grupo"; vertical_id: number; verticais: Vertical | null }
export type ModuloLinha = { id: number; titulo: string; ordem: number }
export type CursoCompleto = { curso: CursoLinha; modulos: ModuloLinha[]; aulas: AulaLinha[]; progresso: Map<number, number> }
export const COLUNAS_CURSO = "id, slug, titulo, descricao, capa_path, nivel_minimo, vertical_id, verticais(nome, nome_en, slug, aceita_entregas)"

export const urlCapa = (caminho: string | null) => (caminho ? supabase.storage.from("imagens").getPublicUrl(caminho).data.publicUrl : null)

// Curso + módulos + aulas + o progresso de quem está logado. Devolve null se o slug não existe (ou não está publicado: o RLS esconde).
export async function carregarCurso(slug: string, uid: string): Promise<CursoCompleto | null> {
  const c = dados(await supabase.from("cursos").select(COLUNAS_CURSO).eq("slug", slug).maybeSingle()) as unknown as CursoLinha | null
  if (!c) return null
  const modulos = dados(await supabase.from("modulos").select("id, titulo, ordem").eq("curso_id", c.id).order("ordem")) as ModuloLinha[]
  const ids = modulos.map((m) => m.id)
  const aulas = ids.length ? (dados(await supabase.from("aulas").select(COLUNAS_AULA).in("modulo_id", ids).order("ordem")) as AulaLinha[]) : []
  const prog = aulas.length ? (dados(await supabase.from("progresso_aula").select("aula_id, percentual").eq("perfil_id", uid).in("aula_id", aulas.map((a) => a.id))) as { aula_id: number; percentual: number }[]) : []
  return { curso: c, modulos, aulas, progresso: new Map(prog.map((p) => [p.aula_id, p.percentual])) }
}
