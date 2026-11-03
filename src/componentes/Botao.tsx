import type { ComponentProps } from "react"
import { useT } from "../i18n"
import { botaoApp, botaoPublico } from "./botaoEstilo"
import { useApp } from "./escopo"

type Props = ComponentProps<"button"> & { variante?: "primario" | "secundario" | "contorno" | "perigo"; ocupado?: boolean }

// `secundario` só existe no app (cinza cheio do MasterClass); no público é o próprio contorno.
const publico = {
  base: `${botaoPublico} w-full disabled:cursor-not-allowed disabled:opacity-36`,
  primario: "bg-destaque text-fundo hover:shadow-brilho",
  secundario: "border border-creme/30 text-creme hover:border-creme/60",
  contorno: "border border-creme/30 text-creme hover:border-creme/60",
  perigo: "bg-red-200 text-red-950 hover:bg-red-100",
}

export function Botao({ variante = "primario", ocupado, children, className = "", disabled, ...resto }: Props) {
  const t = useT()
  const e = useApp() ? botaoApp : publico
  return (
    <button
      disabled={disabled || ocupado}
      aria-busy={ocupado || undefined}
      className={`${e.base} ${e[variante]} ${className}`}
      {...resto}
    >
      {ocupado ? t("comum.aguarde") : children}
    </button>
  )
}
