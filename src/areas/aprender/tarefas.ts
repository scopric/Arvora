import { supabase } from "../../lib/supabase"
import type { EntregaLinha, ExercicioLinha, Vertical } from "./tipos"
import { COLUNAS_ENTREGA, COLUNAS_EXERCICIO } from "./tipos"
import { dados } from "./util"

export type TarefaLinha = {
  exercicio: ExercicioLinha & { aulas: { slug: string; titulo: string; verticais: Vertical | null } | null }
  entrega: EntregaLinha | null
}

// Exercícios que o RLS deixa o membro ver (aula publicada, no nível dele) + as entregas dele. `id` limita a um exercício.
export async function carregarTarefas(uid: string, id?: number): Promise<TarefaLinha[]> {
  let q = supabase.from("exercicios").select(`${COLUNAS_EXERCICIO}, aulas(slug, titulo, verticais(nome, nome_en, slug, aceita_entregas))`).order("aula_id").order("ordem")
  if (id !== undefined) q = q.eq("id", id)
  const exercicios = dados(await q) as unknown as TarefaLinha["exercicio"][]
  const ids = exercicios.map((e) => e.id)
  const entregas = ids.length ? (dados(await supabase.from("entregas").select(COLUNAS_ENTREGA).eq("perfil_id", uid).in("exercicio_id", ids)) as EntregaLinha[]) : []
  return exercicios.map((exercicio) => ({ exercicio, entrega: entregas.find((e) => e.exercicio_id === exercicio.id) ?? null }))
}
