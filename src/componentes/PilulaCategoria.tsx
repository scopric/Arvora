import type { ComponentProps } from "react"
import { pilulaCategoriaApp } from "./botaoEstilo"

// Pílula de categoria do MasterClass ("Category Pill"): dourado em traço; a ativa enche (aria-pressed).
// Só existe no app; para link, use `pilulaCategoriaApp` num <Link> com aria-current.
export function PilulaCategoria({ ativa, className = "", ...resto }: ComponentProps<"button"> & { ativa?: boolean }) {
  return <button type="button" aria-pressed={ativa} className={`${pilulaCategoriaApp} ${className}`} {...resto} />
}
