import type { Idioma } from "../../site"

const LOCAL: Record<Idioma, string> = { pt: "pt-BR", en: "en-IE" }

export const dataLonga = (iso: string, idioma: Idioma) => new Intl.DateTimeFormat(LOCAL[idioma], { dateStyle: "long", timeZone: "Europe/Dublin" }).format(new Date(iso))

// Hora nos dois fusos que importam (Dublin e Brasília), lado a lado. PROVISÓRIO: Europe/Dublin é a decisão provisória do banco.
export function horaDublinBrasilia(iso: string, idioma: Idioma) {
  const f = (timeZone: string) => new Intl.DateTimeFormat(LOCAL[idioma], { hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(iso))
  return { dublin: f("Europe/Dublin"), brasilia: f("America/Sao_Paulo") }
}

export const diaCurto = (iso: string, idioma: Idioma) => new Intl.DateTimeFormat(LOCAL[idioma], { weekday: "short", day: "2-digit", month: "short", timeZone: "Europe/Dublin" }).format(new Date(iso))

// Imagens públicas ficam no bucket `imagens` (leitura aberta, escrita da equipe). Caminho vem do banco; só https/http do próprio Supabase.
export const urlImagem = (path: string | null) =>
  path ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/imagens/${path.split("/").map(encodeURIComponent).join("/")}` : null

export const nomeLocalizado = (x: { nome: string; nome_en: string | null }, idioma: Idioma) => (idioma === "en" && x.nome_en) || x.nome
