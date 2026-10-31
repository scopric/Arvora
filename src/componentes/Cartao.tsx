import type { ComponentProps } from "react"

// Cartão do sistema: raio 16, borda de 1px, sem sombra (PRD §17.7.4). Funciona em fundo escuro e claro.
export function Cartao({ className = "", ...resto }: ComponentProps<"div">) {
  return <div className={`rounded-2xl border border-current/15 bg-superficie/25 p-6 ${className}`} {...resto} />
}
