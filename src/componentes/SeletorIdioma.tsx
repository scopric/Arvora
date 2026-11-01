import { Link, useLocation } from "react-router"
import { useIdioma, useT } from "../i18n"
import { useApp } from "./escopo"

const publico = {
  nav: "flex items-center rounded-full border border-creme/15 p-0.5",
  item: "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-3 font-mono text-xs font-semibold tracking-[0.15em] text-creme/70 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado aria-[current=true]:bg-creme/12 aria-[current=true]:text-white",
}

// App (Linear pill segmentada): 28px de altura, 12px/510, hairline grafite; o atual ganha fundo creme/5.
const app = {
  nav: "flex items-center rounded-full border border-grafite p-0.5",
  item: "inline-flex h-7 min-w-9 items-center justify-center rounded-full px-2.5 text-xs font-medium text-nevoa transition-colors pointer-coarse:min-h-11 hover:text-creme focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado aria-[current=true]:bg-creme/5 aria-[current=true]:text-creme",
}

// Troca só o prefixo de idioma; o resto do caminho, a busca e o hash ficam. O nome completo do idioma vai no
// aria-label e no title (WCAG 3.1.2); o texto visível é a sigla. `className` posiciona (inline por padrão).
export function SeletorIdioma({ className = "" }: { className?: string }) {
  const t = useT()
  const atual = useIdioma()
  const e = useApp() ? app : publico
  const { pathname, search, hash } = useLocation()
  const resto = pathname.replace(/^\/[^/]*/, "") + search + hash
  const link = (lang: "pt" | "en", nome: string, html: string) => (
    <Link to={`/${lang}${resto}`} hrefLang={lang} lang={html} aria-label={nome} title={nome} aria-current={atual === lang ? "true" : undefined} className={e.item}>
      {lang.toUpperCase()}
    </Link>
  )
  return (
    <nav aria-label={t("idioma.rotulo")} className={`${e.nav} ${className}`}>
      {link("pt", "Português", "pt-BR")}
      {link("en", "English", "en")}
    </nav>
  )
}
