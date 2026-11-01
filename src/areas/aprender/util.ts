import { botaoContornoApp, botaoPrimarioApp } from "../../componentes/botaoEstilo"
import { linkTextoApp } from "../../componentes/menuApp"
import { SITE_URL } from "../../site"
import { supabase } from "../../lib/supabase"

// Datas da plataforma: sempre Europe/Dublin (PRD AUL-01), com Brasília ao lado para quem assiste do Brasil.
export const FUSO = "Europe/Dublin"
export const FUSO_BR = "America/Sao_Paulo"

const local = (lang: string) => (lang === "pt" ? "pt-BR" : "en-IE")

export const formatar = (iso: string, lang: string, opcoes: Intl.DateTimeFormatOptions, fuso = FUSO) =>
  new Intl.DateTimeFormat(local(lang), { timeZone: fuso, ...opcoes }).format(new Date(iso))

export const dataCurta = (iso: string, lang: string) => formatar(iso, lang, { day: "numeric", month: "short" })
export const dataLonga = (iso: string, lang: string, fuso = FUSO) =>
  formatar(iso, lang, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }, fuso)
export const hora = (iso: string, lang: string, fuso = FUSO) => formatar(iso, lang, { hour: "2-digit", minute: "2-digit" }, fuso)

// Segunda-feira (AAAA-MM-DD) da semana da data, contada em Dublin. Agrupa a lista de aulas por semana.
export function segundaDaSemana(iso: string): string {
  const [a, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(iso))
    .split("-")
    .map(Number)
  const dia = new Date(Date.UTC(a, m - 1, d))
  dia.setUTCDate(dia.getUTCDate() - ((dia.getUTCDay() + 6) % 7))
  return dia.toISOString().slice(0, 10)
}

export const minutosParaTexto = (seg: number) => `${Math.floor(seg / 60)}:${String(Math.floor(seg % 60)).padStart(2, "0")}`

// --- Agenda (AUL-01): .ics gerado no navegador e link do Google Agenda. Os dois usam horário UTC.
export type AulaAgenda = { id: number; slug: string; titulo: string; inicio_em: string; duracao_min: number | null; descricao?: string | null }
const DURACAO_PADRAO_MIN = 60 // quando a aula não registra duração

const utc = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
const fim = (a: AulaAgenda) => new Date(new Date(a.inicio_em).getTime() + (a.duracao_min ?? DURACAO_PADRAO_MIN) * 60000)
const escapar = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n")
// RFC 5545: linhas com mais de 75 octetos são dobradas (CRLF + espaço). Conta octetos UTF-8 e nunca corta um caractere ao meio.
const codificador = new TextEncoder()
function dobrar(linha: string) {
  let saida = ""
  let octetos = 0
  for (const c of linha) {
    const n = codificador.encode(c).length
    if (octetos + n > 75) {
      saida += "\r\n "
      octetos = 1
    }
    saida += c
    octetos += n
  }
  return saida
}

export function gerarIcs(a: AulaAgenda, lang: string): string {
  const url = `${SITE_URL}/${lang}/aulas/${a.slug}`
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Grupo Arvora//Aulas//PT",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:aula-${a.id}@arvora`,
    `DTSTAMP:${utc(new Date())}`,
    `DTSTART:${utc(new Date(a.inicio_em))}`,
    `DTEND:${utc(fim(a))}`,
    `SUMMARY:${escapar(a.titulo)}`,
    `DESCRIPTION:${escapar(`${a.descricao ? a.descricao + "\n" : ""}${url}`)}`,
    `URL:${url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .map(dobrar)
    .join("\r\n")
}

export function baixarIcs(a: AulaAgenda, lang: string) {
  const arquivo = URL.createObjectURL(new Blob([gerarIcs(a, lang)], { type: "text/calendar;charset=utf-8" }))
  const link = document.createElement("a")
  link.href = arquivo
  link.download = `${a.slug}.ics`
  link.click()
  URL.revokeObjectURL(arquivo)
}

export function linkGoogleAgenda(a: AulaAgenda, lang: string): string {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: a.titulo,
    dates: `${utc(new Date(a.inicio_em))}/${utc(fim(a))}`,
    details: `${SITE_URL}/${lang}/aulas/${a.slug}`,
  })
  return `https://calendar.google.com/calendar/render?${p}`
}

// --- Vídeo: o provedor não foi decidido; o banco guarda `video_id`. Se for URL https vira player; senão, "indisponível".
// .mp4/.m3u8 tocam no <video>; qualquer outra URL https vai para o iframe do provedor.
export function videoDe(id: string | null): { tipo: "arquivo" | "embed"; src: string } | null {
  if (!id || !URL.canParse(id)) return null
  const u = new URL(id)
  if (u.protocol !== "https:" && !(import.meta.env.DEV && u.protocol === "http:")) return null
  return { tipo: /\.(mp4|m3u8)$/i.test(u.pathname) ? "arquivo" : "embed", src: id }
}

// --- Progresso (ACA-03). O upsert não serve: o banco só deixa atualizar percentual e posicao_seg (grant por coluna),
// e o upsert reescreveria perfil_id e aula_id. Por isso: UPDATE com .select (Erros 2.5) e, se não casou linha, INSERT.
export async function gravarProgresso(uid: string, aulaId: number, percentual: number, posicao: number): Promise<boolean> {
  const valores = { percentual: Math.max(0, Math.min(100, Math.round(percentual))), posicao_seg: Math.max(0, Math.floor(posicao)) }
  const atualizar = () => supabase.from("progresso_aula").update(valores).eq("perfil_id", uid).eq("aula_id", aulaId).select("aula_id")
  const a = await atualizar()
  if (a.error) return false
  if (a.data.length > 0) return true
  const i = await supabase.from("progresso_aula").insert({ perfil_id: uid, aula_id: aulaId, ...valores })
  if (i.error?.code === "23505") {
    const b = await atualizar() // outra aba criou a linha no meio do caminho
    return !b.error && b.data.length > 0
  }
  return !i.error
}

// Lança se a consulta falhou: quem chama trata como erro na tela, nunca como lista vazia (Erros 3.2).
export function dados<T>(r: { data: T; error: unknown }): T {
  if (r.error) throw r.error
  return r.data
}

// Para listas: erro lança; sem linhas vem [] (o tipo do supabase-js admite null).
export function linhas<T>(r: { data: T[] | null; error: unknown }): T[] {
  if (r.error) throw r.error
  return r.data ?? []
}

export const foco = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado"
// Botões e link de texto desta área (só existe no app): mesmo spec do Botao (botaoEstilo.ts); o link sublinha em cinza e acende no hover.
export const botaoLink = botaoPrimarioApp
export const botaoContorno = botaoContornoApp
export const linkTexto = linkTextoApp
// Mesmo spec do Campo no app (campoEstilo.ts): esta área só existe dentro do escopo do app.
export const campoBase =
  "w-full rounded-md border border-cinza bg-creme/2 px-3.5 py-3 text-base text-creme placeholder:text-nevoa outline-none transition-colors focus-visible:border-bruma"
// Cartão, caixa sutil e barra de progresso do app (molde Linear). <progress> nativo pintado: trilho fumaça, valor dourado.
export const cartao = "rounded-xl p-5 shadow-borda"
export const caixaSutil = "rounded-md bg-creme/2 px-4 py-3 text-base shadow-borda"
export const barraProgresso =
  "h-1 w-40 appearance-none overflow-hidden rounded-full bg-fumaca accent-dourado [&::-moz-progress-bar]:bg-dourado [&::-webkit-progress-bar]:bg-fumaca [&::-webkit-progress-value]:bg-dourado"
