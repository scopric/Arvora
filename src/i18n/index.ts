import { useEffect } from "react"
import { useLocation, useParams } from "react-router"
import { IDIOMAS, type Idioma } from "../site"
import { en } from "./en"
import { pt } from "./pt"

const dicionarios: Record<Idioma, Record<keyof typeof pt, string>> = { pt, en }
const CHAVE = "arvora.idioma"

export const ehIdioma = (v: string | undefined): v is Idioma => IDIOMAS.some((i) => i === v)

// Dentro de /:lang o idioma é sempre válido (o layout redireciona o resto); o pt é só rede de segurança.
export function useIdioma(): Idioma {
  const { lang } = useParams()
  return ehIdioma(lang) ? lang : "pt"
}

export type Chave = keyof typeof pt

export function useT() {
  const dic = dicionarios[useIdioma()]
  // Aceita chave ausente (erro de campo sem erro) e devolve undefined.
  function t(chave: Chave): string
  function t(chave: Chave | undefined): string | undefined
  function t(chave?: Chave) {
    return chave && dic[chave]
  }
  return t
}

export function useCaminho() {
  const lang = useIdioma()
  return (rota: string) => `/${lang}${rota === "/" ? "" : rota}`
}

export function gravarIdioma(lang: Idioma) {
  try {
    localStorage.setItem(CHAVE, lang)
  } catch {
    // armazenamento bloqueado: segue sem lembrar
  }
}

// Último idioma escolhido; senão o do navegador (pt* → pt, resto → en).
export function idiomaPreferido(): Idioma {
  try {
    const salvo = localStorage.getItem(CHAVE)
    if (ehIdioma(salvo ?? undefined)) return salvo as Idioma
  } catch {
    // ignora
  }
  const [primeiro] = navigator.languages?.length ? navigator.languages : [navigator.language ?? ""]
  return primeiro?.toLowerCase().startsWith("pt") ? "pt" : "en"
}

export const textosDe = (lang: Idioma) => dicionarios[lang]

// Idioma pelo 1º segmento da URL; sem prefixo, o preferido (só no navegador); senão pt.
export function idiomaDoCaminho(pathname: string): Idioma {
  const primeiro = pathname.split("/")[1]
  if (ehIdioma(primeiro)) return primeiro
  return typeof window === "undefined" ? "pt" : idiomaPreferido()
}

// Para componentes fora do /:lang (fallbacks e erro do root): lê o idioma da URL, sem useParams.
export function useIdiomaUrl(): Idioma {
  return idiomaDoCaminho(useLocation().pathname)
}

function definirMeta(nome: string, conteudo: string | null) {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${nome}"]`)
  if (conteudo === null) return el?.remove()
  if (!el) {
    if (nome !== "robots") return // description só é atualizada se já existir
    el = document.head.appendChild(document.createElement("meta"))
    el.name = nome
  }
  el.content = conteudo
}

// Título da aba ("<tela> — Grupo Árvora") e description no idioma da página; noindex reforça o X-Robots-Tag do vercel.json.
export function useTitulo(chave: "doc.titulo" | `titulo.${string}` & Chave, noindex = false) {
  const idioma = useIdioma()
  useEffect(() => {
    const dic = dicionarios[idioma]
    document.title = chave === "doc.titulo" ? dic[chave] : `${dic[chave]} — Grupo Árvora`
    definirMeta("description", dic["doc.descricao"])
    if (!noindex) return
    definirMeta("robots", "noindex")
    return () => definirMeta("robots", null)
  }, [idioma, chave, noindex])
}
