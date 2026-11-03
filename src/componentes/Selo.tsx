import type { ReactNode } from "react"
import { useApp } from "./escopo"

const tons = {
  neutro: "border-current/30",
  destaque: "border-destaque text-destaque",
  // Público: dourado identifica o braço Brazilian Awards (PRD §17.7.1). No app o tom vira indicador genérico (Premiado, Nova): Decisão 55.
  dourado: "border-dourado text-dourado",
  alerta: "border-red-300/60 text-red-200",
}

// App (MasterClass "New" badge): pílula 14px/600. Neutro em cinza cheio; dourado cheio com texto breu (Premiado,
// Nova: o papel do magenta do MasterClass); o verde-sálvia fica só como status "ok".
const tonsApp = {
  neutro: "bg-fumaca text-creme",
  destaque: "bg-destaque/15 text-destaque",
  dourado: "bg-dourado text-breu",
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
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-corpo-p font-semibold ${tonsApp[tom]}`}>{children}</span>
}
