import { Link } from "react-router"
import { useApp } from "./escopo"

// Símbolo do logo (árvore, recortado do logo oficial) + nome em caixa alta.
// App (MasterClass): símbolo de 24px e nome em 16px/600 creme, sem caixa alta nem espaço aberto.
export function Marca({ to, className = "" }: { to?: string; className?: string }) {
  const app = useApp()
  const classes = app
    ? `inline-flex min-h-11 items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado ${className}`
    : `inline-flex min-h-11 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destaque ${className}`
  const conteudo = (
    <>
      <img src="/logo-simbolo.png" alt="" width="354" height="287" className={app ? "h-6 w-auto" : "h-8 w-auto"} />
      <span className={app ? "text-corpo font-semibold text-creme" : "text-xs font-semibold tracking-[0.3em] text-destaque uppercase"}>Grupo Árvora</span>
    </>
  )
  return to ? (
    <Link to={to} aria-label={app ? "Grupo Árvora" : undefined} className={classes}>
      {conteudo}
    </Link>
  ) : (
    <p className={classes}>{conteudo}</p>
  )
}
