import type { ComponentProps } from "react"
import { useApp } from "./escopo"

// Cartão do sistema: borda de 1px, sem sombra (PRD §17.7.4). Público: raio 16, funciona em fundo escuro e claro.
// App (camada vidro da Decisão 70 sobre a "charcoal plate" do MasterClass): placa translúcida, raio 8.
// As strings ficam exportadas para <form>/<section> com o mesmo visual e para a moldura condicional do CrudTabela.
export const cartaoApp = "rounded-lg p-6 vidro"
// Caixa sutil (ardósia com hairline): subbloco dentro de um cartão, painel de ações, mensagem citada, opção de rádio.
export const caixaSutilApp = "rounded-lg bg-ardosia px-4 py-3 shadow-borda"
export function Cartao({ className = "", ...resto }: ComponentProps<"div">) {
  const base = useApp() ? cartaoApp : "rounded-2xl border border-current/15 bg-superficie/25 p-6"
  return <div className={`${base} ${className}`} {...resto} />
}
