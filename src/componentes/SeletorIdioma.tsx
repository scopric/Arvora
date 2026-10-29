import { Link, useLocation } from "react-router"
import { useIdioma, useT } from "../i18n"

const link =
  "inline-flex min-h-11 items-center rounded-lg px-4 text-creme transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado aria-[current=true]:font-bold aria-[current=true]:underline aria-[current=true]:decoration-dourado aria-[current=true]:underline-offset-4"

// Troca só o prefixo de idioma; o resto do caminho, a busca e o hash ficam.
export function SeletorIdioma() {
  const t = useT()
  const atual = useIdioma()
  const { pathname, search, hash } = useLocation()
  const resto = pathname.replace(/^\/[^/]*/, "") + search + hash
  const item = (lang: "pt" | "en", nome: string, html: string) => (
    <Link to={`/${lang}${resto}`} hrefLang={lang} lang={html} aria-current={atual === lang ? "true" : undefined} className={link}>
      {nome}
    </Link>
  )
  return (
    <nav aria-label={t("idioma.rotulo")} className="absolute top-0 left-0 flex min-h-17 items-center gap-1 px-4 py-3 text-sm font-semibold sm:px-12">
      {item("pt", "Português", "pt-BR")}
      {item("en", "English", "en")}
    </nav>
  )
}
