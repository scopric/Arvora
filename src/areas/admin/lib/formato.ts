export const FUSO = "Europe/Dublin"

const idiomaIntl = (lang: string) => (lang === "pt" ? "pt-BR" : "en-IE")

type Partes = { y: number; m: number; d: number; h: number; mi: number }
function partes(ms: number, fuso: string): Partes {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: fuso, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, Number(x.value)]))
  return { y: p.year, m: p.month, d: p.day, h: p.hour, mi: p.minute }
}
const comoUtc = (p: Partes) => Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi)

// Hora de parede no fuso (Dublin) ↔ instante UTC. O <input type="datetime-local"> do admin é sempre hora de Dublin (PRD: fuso do evento).
export function isoParaLocal(iso: string | null | undefined, fuso = FUSO): string {
  if (!iso) return ""
  const p = partes(new Date(iso).getTime(), fuso)
  const z = (n: number) => String(n).padStart(2, "0")
  return `${p.y}-${z(p.m)}-${z(p.d)}T${z(p.h)}:${z(p.mi)}`
}
export function localParaIso(local: string, fuso = FUSO): string {
  const [dia, hora] = local.split("T")
  const [y, m, d] = dia.split("-").map(Number)
  const [h, mi] = (hora ?? "00:00").split(":").map(Number)
  const alvo = Date.UTC(y, m - 1, d, h, mi)
  let ms = alvo - (comoUtc(partes(alvo, fuso)) - alvo)
  ms = alvo - (comoUtc(partes(ms, fuso)) - ms) // segunda volta corrige a borda do horário de verão
  return new Date(ms).toISOString()
}

export function dataHora(iso: string | null | undefined, lang: string, fuso = FUSO): string {
  if (!iso) return "—"
  return new Intl.DateTimeFormat(idiomaIntl(lang), { timeZone: fuso, dateStyle: "short", timeStyle: "short" }).format(new Date(iso))
}
// 'YYYY-MM-DD' → dd/mm/aaaa sem passar por Date (evita deslocar o dia por fuso).
export function dataCurta(d: string | null | undefined): string {
  if (!d) return "—"
  const [y, m, dd] = d.slice(0, 10).split("-")
  return `${dd}/${m}/${y}`
}
export function moeda(centavos: number | null | undefined, lang: string, codigo = "EUR"): string {
  if (centavos === null || centavos === undefined) return "—"
  return new Intl.NumberFormat(idiomaIntl(lang), { style: "currency", currency: codigo }).format(centavos / 100)
}
// "12,50" ou "12.50" → 1250. Qualquer outra coisa → null.
export function decimalParaCentavos(texto: string): number | null {
  const s = texto.trim().replace(",", ".")
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null
  return Math.round(Number(s) * 100)
}
export function slugificar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100)
}

// Ciclo do Relatório: do dia 10 ao dia 9 (PRD §7.15). Devolve o início ('YYYY-MM-DD') do Ciclo que contém `hoje` ('YYYY-MM-DD', data de Dublin).
export function cicloDe(hoje: string): string {
  const [y, m, d] = hoje.split("-").map(Number)
  const z = (n: number) => String(n).padStart(2, "0")
  if (d >= 10) return `${y}-${z(m)}-10`
  return m === 1 ? `${y - 1}-12-10` : `${y}-${z(m - 1)}-10`
}
export function cicloAnterior(inicio: string): string {
  const [y, m] = inicio.split("-").map(Number)
  const z = (n: number) => String(n).padStart(2, "0")
  return m === 1 ? `${y - 1}-12-10` : `${y}-${z(m - 1)}-10`
}
export function cicloFim(inicio: string): string {
  const [y, m] = inicio.split("-").map(Number)
  const z = (n: number) => String(n).padStart(2, "0")
  return m === 12 ? `${y + 1}-01-09` : `${y}-${z(m + 1)}-09`
}
export const hojeEmDublin = () => isoParaLocal(new Date().toISOString()).slice(0, 10)
