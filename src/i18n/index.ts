import { useParams } from "react-router"
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

export function useT() {
  const dic = dicionarios[useIdioma()]
  return (chave: keyof typeof pt) => dic[chave]
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
