import type { Relatorio } from "./relatorio"

export type EstadoAula = "rascunho" | "agendada" | "publicados"
export const estadoAula = (a: { agendada_em: string | null; materiais_publicados_em: string | null }): EstadoAula =>
  a.materiais_publicados_em ? "publicados" : a.agendada_em ? "agendada" : "rascunho"

// Fase (antes/durante/depois) pelas datas, igual a public.fase().
export const faseDe = (e: { durante_inicio: string; durante_fim: string }, agora = Date.now()) =>
  agora < Date.parse(e.durante_inicio) ? "antes" : agora <= Date.parse(e.durante_fim) ? "durante" : "depois"

const REDES = ["instagram", "linkedin", "site"] as const
export type Json = Record<string, unknown>

// premiados.redes é um objeto livre; o formulário edita as três chaves usuais e preserva as outras.
export const redesParaCampos = (redes: unknown): Json =>
  Object.fromEntries(REDES.map((k) => [`redes_${k}`, (redes as Json | null)?.[k] ?? ""]))
export function camposParaRedes(carga: Json, antigas: unknown): Json {
  const redes: Json = { ...((antigas as Json | null) ?? {}) }
  for (const k of REDES) {
    const v = carga[`redes_${k}`]
    if (typeof v === "string" && v !== "") redes[k] = v
    else delete redes[k]
  }
  return redes
}

export const VIGENTES: ("active" | "trialing" | "past_due")[] = ["active", "trialing", "past_due"]

// Dias até o prazo (negativo = vencido). Datas 'YYYY-MM-DD' em UTC puro para não depender do fuso do navegador.
export function diasAte(prazo: string, hoje: string) {
  return Math.round((Date.parse(prazo.slice(0, 10)) - Date.parse(hoje)) / 86400000)
}

export const TIPOS_MATERIAL = ["resumo", "ebook", "exercicios"] as const

// Pendências que o banco recusa ao fechar (fechar_ciclo): sem câmbio ou item sem plano.
export const bloqueia = (r: Relatorio) => r.pendencias.some((p) => p.tipo === "cambio_ausente" || p.tipo === "item_sem_plano")

