import { Link } from "react-router"
import { useApp } from "./escopo"

// Símbolo do logo (árvore, recortado de Documentos/Logo no cofre) + nome em caixa alta.
// App (Linear): símbolo de 20px e nome em 13px/590 creme, sem caixa alta nem espaço aberto.
export function Marca({ to, className = "" }: { to?: string; className?: string }) {
  const app = useApp()
  const classes = app
    ? `inline-flex min-h-9 items-center gap-2 rounded-md pointer-coarse:min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado ${className}`
    : `inline-flex min-h-11 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado ${className}`
  const conteudo = (
    <>
      <img src="/logo-simbolo.png" alt="" width="354" height="287" className={app ? "h-5 w-auto" : "h-8 w-auto"} />
      <span className={app ? "text-legenda font-semibold text-creme" : "text-xs font-semibold tracking-[0.3em] text-destaque uppercase"}>Grupo Árvora</span>
    </>
  )
  return to ? (
    <Link to={to} className={classes}>
      {conteudo}
    </Link>
  ) : (
    <p className={classes}>{conteudo}</p>
  )
}
