import type { ReactNode } from "react"

const tons = {
  neutro: "border-current/30",
  destaque: "border-destaque text-destaque",
  // Dourado identifica o braço Brazilian Awards (PRD §17.7.1): use este tom só nesse contexto (ex.: selo Premiado).
  dourado: "border-dourado text-dourado",
  alerta: "border-red-300/60 text-red-200",
}

// Pílula de status (Premiado, Grupo, Pendente). O sentido vai no texto, nunca só na cor.
export function Selo({ tom = "neutro", children }: { tom?: keyof typeof tons; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-semibold tracking-wide ${tons[tom]}`}>
      {children}
    </span>
  )
}
