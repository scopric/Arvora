import type { ReactNode } from "react"
import { useApp } from "./escopo"

const tons = {
  neutro: "border-current/30",
  destaque: "border-destaque text-destaque",
  // Dourado identifica o braço Brazilian Awards (PRD §17.7.1): use este tom só nesse contexto (ex.: selo Premiado).
  dourado: "border-dourado text-dourado",
  alerta: "border-red-300/60 text-red-200",
}

// App (Linear Badge): raio 4, fundo creme/5, 12px/510. O dourado entra só como ponto (indicador), nunca como superfície;
// o verde-sálvia fica só como status "ok".
const tonsApp = {
  neutro: "text-nevoa",
  destaque: "text-destaque",
  dourado: "text-creme",
  alerta: "bg-red-300/10 text-red-300",
}

// Pílula de status (Premiado, Grupo, Pendente). O sentido vai no texto, nunca só na cor.
export function Selo({ tom = "neutro", children }: { tom?: keyof typeof tons; children: ReactNode }) {
  if (!useApp()) {
    return (
      <span className={`inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-semibold tracking-wide ${tons[tom]}`}>
        {children}
      </span>
    )
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-sm bg-creme/5 px-1.5 py-0.5 text-xs font-medium ${tonsApp[tom]}`}>
      {tom === "dourado" ? <span aria-hidden="true" className="size-1.5 rounded-full bg-dourado" /> : null}
      {children}
    </span>
  )
}
