import { Link, useLocation } from "react-router"
import { useIdioma, useT } from "../i18n"
import { useApp } from "./escopo"

const publico = {
  nav: "flex items-center rounded-full border border-creme/15 p-0.5",
  item: "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-3 font-mono text-xs font-semibold tracking-[0.08em] text-creme/70 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destaque aria-[current=true]:bg-creme/12 aria-[current=true]:text-white",
}

// App (MasterClass, pílula segmentada em carvão): 32px de altura, 14px/600 cinza; o atual ganha fundo fumaça, texto creme e anel dourado (forma + cor).
const app = {
  nav: "flex items-center rounded-full bg-carvao p-0.5",
  item: "inline-flex h-8 min-w-10 items-center justify-center rounded-full px-3 text-corpo-p font-semibold text-cinza transition-colors pointer-coarse:min-h-11 pointer-coarse:min-w-11 hover:text-creme focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado aria-[current=true]:bg-fumaca aria-[current=true]:text-creme aria-[current=true]:ring-1 aria-[current=true]:ring-dourado aria-[current=true]:ring-inset",
}

// Troca só o prefixo de idioma; o resto do caminho, a busca e o hash ficam. O nome completo do idioma vai no
// aria-label e no title (WCAG 3.1.2); o texto visível é a sigla. `className` posiciona (inline por padrão).
export function SeletorIdioma({ className = "" }: { className?: string }) {
  const t = useT()
  const atual = useIdioma()
  const e = useApp() ? app : publico
  const { pathname, search, hash } = useLocation()
  const resto = pathname.replace(/^\/[^/]*/, "") + search + hash
  // O nome acessível contém o texto visível ("PT") e o nome completo (WCAG 2.5.3 e 3.1.2).
  const link = (lang: "pt" | "en", nome: string, html: string) => (
    <Link to={`/${lang}${resto}`} hrefLang={lang} lang={html} aria-label={`${lang.toUpperCase()} – ${nome}`} title={nome} aria-current={atual === lang ? "true" : undefined} className={e.item}>
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
