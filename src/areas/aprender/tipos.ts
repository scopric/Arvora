import type { Nivel } from "../../lib/acesso"

// Colunas lidas (nunca `select *`) e o formato de cada linha. Sem `video_id`: ele só é lido em Gravacao.tsx.
export type Vertical = { nome: string; nome_en: string | null; slug: string; aceita_entregas: boolean }
export type AulaLinha = {
  id: number
  slug: string
  titulo: string
  descricao: string | null
  tipo: "gravada" | "ao_vivo"
  nivel_minimo: Exclude<Nivel, "visitante">
  inicio_em: string | null
  duracao_min: number | null
  vertical_id: number
  modulo_id: number | null
  ordem: number
  agendada_em: string | null
  materiais_publicados_em: string | null
}
export const COLUNAS_AULA = "id, slug, titulo, descricao, tipo, nivel_minimo, inicio_em, duracao_min, vertical_id, modulo_id, ordem, agendada_em, materiais_publicados_em"

export type ExercicioLinha = { id: number; aula_id: number; ordem: number; enunciado_md: string; prazo_dias: number | null; aceita_arquivo: boolean }
export const COLUNAS_EXERCICIO = "id, aula_id, ordem, enunciado_md, prazo_dias, aceita_arquivo"

export type EntregaLinha = {
  id: number
  exercicio_id: number
  texto: string | null
  arquivo_path: string | null
  status: "enviada" | "aprovada" | "ajustar"
  devolutiva: string | null
  enviada_em: string
  corrigido_em: string | null
}
export const COLUNAS_ENTREGA = "id, exercicio_id, texto, arquivo_path, status, devolutiva, enviada_em, corrigido_em"

export const nomeVertical = (v: { nome: string; nome_en: string | null }, lang: string) => (lang === "en" ? (v.nome_en ?? v.nome) : v.nome)
