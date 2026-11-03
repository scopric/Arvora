import type { Idioma } from "../../site"

const DIA_MS = 86_400_000
const PRAZO_ARREPENDIMENTO_DIAS = 14

// Datas na hora de Dublin (fuso provisório do banco).
export const dataCurta = (iso: string, idioma: Idioma) =>
  new Date(iso).toLocaleDateString(idioma === "pt" ? "pt-BR" : "en-IE", { timeZone: "Europe/Dublin" })

export const horaCurta = (iso: string, idioma: Idioma) =>
  new Date(iso).toLocaleTimeString(idioma === "pt" ? "pt-BR" : "en-IE", { timeZone: "Europe/Dublin", hour: "2-digit", minute: "2-digit" })

// `prazo_em` do banco é só data (AAAA-MM-DD): lida como meio-dia UTC para não escorregar de dia.
export const dataDoDia = (dia: string, idioma: Idioma) => dataCurta(`${dia}T12:00:00Z`, idioma)

export const dinheiro = (centavos: number, moeda: string, idioma: Idioma) =>
  new Intl.NumberFormat(idioma === "pt" ? "pt-BR" : "en-IE", { style: "currency", currency: moeda }).format(centavos / 100)

// Mesma base da função excluir-conta: criação da assinatura no Stripe, senão a data da linha. Data inválida: null (a tela não afirma prazo).
export function prazoArrependimento(inicioIso: string, agora = Date.now()) {
  const fim = Date.parse(inicioIso) + PRAZO_ARREPENDIMENTO_DIAS * DIA_MS
  return Number.isNaN(fim) ? null : { fim: new Date(fim).toISOString(), aberto: agora < fim }
}

// Grupos da lista de notificações (molde Jace).
export type Grupo = "hoje" | "semana" | "antes"
// "Hoje" = mesmo dia civil no fuso do navegador (ou data no futuro, relógio atrasado); "semana" = últimos 7 dias corridos.
export function grupoDe(iso: string, agoraMs: number): Grupo {
  const d = new Date(iso)
  if (d.getTime() >= agoraMs || d.toDateString() === new Date(agoraMs).toDateString()) return "hoje"
  return agoraMs - d.getTime() < 7 * 86_400_000 ? "semana" : "antes"
}
