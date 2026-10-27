import { Link } from "react-router"

// Símbolo do logo (árvore, recortado de Documentos/Logo no cofre) + nome em caixa alta.
export function Marca({ to, className = "" }: { to?: string; className?: string }) {
  const classes = `inline-flex items-center gap-3 ${className}`
  const conteudo = (
    <>
      <img src="/logo-simbolo.png" alt="" width="354" height="287" className="h-8 w-auto" />
      <span className="text-xs font-semibold tracking-[0.3em] text-destaque uppercase">Grupo Árvora</span>
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
