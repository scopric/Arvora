import type { ReactNode } from "react"
import { caixaSutilApp } from "./Cartao"
import { useApp } from "./escopo"

// Erro e sucesso aparecem na tela, com texto; nunca viram lista vazia nem só cor (Erros 3.2).
export function Aviso({ tipo, children }: { tipo: "erro" | "ok"; children: ReactNode }) {
  const role = tipo === "erro" ? "alert" : "status"
  if (!useApp()) {
    const cor = tipo === "erro" ? "border-red-300/60 text-red-200" : "border-destaque/60 text-destaque"
    return (
      <p role={role} className={`rounded-lg border px-4 py-3 text-sm ${cor}`}>
        {children}
      </p>
    )
  }
  // App (MasterClass): bloco aninhado em ardósia com hairline; a cor fica num ponto, o texto segue em creme.
  return (
    <p role={role} className={`flex items-start gap-3 text-corpo text-creme ${caixaSutilApp}`}>
      <span aria-hidden="true" className={`mt-2 size-1.5 shrink-0 rounded-full ${tipo === "erro" ? "bg-red-300" : "bg-destaque"}`} />
      <span>{children}</span>
    </p>
  )
}
