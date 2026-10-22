import type { ReactNode } from "react"

// Erro e sucesso aparecem na tela, com texto; nunca viram lista vazia nem só cor (Erros 3.2).
export function Aviso({ tipo, children }: { tipo: "erro" | "ok"; children: ReactNode }) {
  const cor = tipo === "erro" ? "border-red-300/60 text-red-200" : "border-destaque/60 text-destaque"
  return (
    <p role={tipo === "erro" ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm ${cor}`}>
      {children}
    </p>
  )
}
