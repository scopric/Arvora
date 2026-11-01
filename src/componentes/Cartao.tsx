import type { ComponentProps } from "react"
import { useApp } from "./escopo"

// Cartão do sistema: borda de 1px, sem sombra (PRD §17.7.4). Público: raio 16, funciona em fundo escuro e claro.
// App (Linear): superfície carvão, raio 12, hairline por inset.
export function Cartao({ className = "", ...resto }: ComponentProps<"div">) {
  const base = useApp() ? "rounded-xl bg-carvao p-6 shadow-borda" : "rounded-2xl border border-current/15 bg-superficie/25 p-6"
  return <div className={`${base} ${className}`} {...resto} />
}
