import { Link, useLocation } from "react-router"
import { useIdioma, useT } from "../i18n"

// Bandeiras em SVG inline (emoji de bandeira não aparece no Windows). Só enfeite: o nome do idioma vai no
// aria-label e no title do link (WCAG 3.1.2). Bandeira representa país, não idioma: o texto continua acessível.
const caixa = "h-5 w-[30px] shrink-0 overflow-hidden rounded-[3px] ring-1 ring-white/25"

function BandeiraBrasil() {
  return (
    <svg viewBox="0 0 28 20" aria-hidden="true" focusable="false" className={caixa}>
      <rect width="28" height="20" fill="#009C3B" />
      <path d="M14 2 25.5 10 14 18 2.5 10Z" fill="#FFDF00" />
      <circle cx="14" cy="10" r="4.2" fill="#002776" />
      <path d="M9.9 9.2c3.1-.9 6.1-.5 8.4 1.5" fill="none" stroke="#fff" strokeWidth=".8" />
    </svg>
  )
}

function BandeiraReinoUnido() {
  return (
    <svg viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false" className={caixa}>
      <clipPath id="bandeira-gb-a">
        <path d="M0 0v30h60V0z" />
      </clipPath>
      <clipPath id="bandeira-gb-b">
        <path d="M30 15h30v15zv15H0zH0V0zV0h30z" />
      </clipPath>
      <g clipPath="url(#bandeira-gb-a)">
        <path d="M0 0v30h60V0z" fill="#012169" />
        <path d="M0 0 60 30M60 0 0 30" stroke="#fff" strokeWidth="6" />
        <path d="M0 0 60 30M60 0 0 30" clipPath="url(#bandeira-gb-b)" stroke="#C8102E" strokeWidth="4" />
        <path d="M30 0v30M0 15h60" stroke="#fff" strokeWidth="10" />
        <path d="M30 0v30M0 15h60" stroke="#C8102E" strokeWidth="6" />
      </g>
    </svg>
  )
}

const link =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-2 opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado aria-[current=true]:opacity-100 aria-[current=true]:[&>svg]:ring-2 aria-[current=true]:[&>svg]:ring-dourado"

// Troca só o prefixo de idioma; o resto do caminho, a busca e o hash ficam.
export function SeletorIdioma({ lado = "left-0" }: { lado?: "left-0" | "right-0" }) {
  const t = useT()
  const atual = useIdioma()
  const { pathname, search, hash } = useLocation()
  const resto = pathname.replace(/^\/[^/]*/, "") + search + hash
  const item = (lang: "pt" | "en", nome: string, html: string, bandeira: React.ReactNode) => (
    <Link
      to={`/${lang}${resto}`}
      hrefLang={lang}
      lang={html}
      aria-label={nome}
      title={nome}
      aria-current={atual === lang ? "true" : undefined}
      className={link}
    >
      {bandeira}
    </Link>
  )
  return (
    <nav aria-label={t("idioma.rotulo")} className={`absolute top-0 ${lado} flex min-h-17 items-center gap-1 px-4 py-3 sm:px-12`}>
      {item("pt", "Português", "pt-BR", <BandeiraBrasil />)}
      {item("en", "English", "en", <BandeiraReinoUnido />)}
    </nav>
  )
}
