import type { ComponentProps } from "react"
import { useApp } from "./escopo"

// Cartão do sistema: borda de 1px, sem sombra (PRD §17.7.4). Público: raio 16, funciona em fundo escuro e claro.
// App (camada vidro da Decisão 70 sobre a "charcoal plate" do MasterClass): placa translúcida com desfoque, raio 8.
export function Cartao({ className = "", ...resto }: ComponentProps<"div">) {
  const base = useApp() ? "rounded-lg p-6 vidro" : "rounded-2xl border border-current/15 bg-superficie/25 p-6"
  return <div className={`${base} ${className}`} {...resto} />
}
