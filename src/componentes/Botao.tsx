import type { ComponentProps } from "react"
import { useT } from "../i18n"
import { botaoApp } from "./botaoEstilo"
import { useApp } from "./escopo"

type Props = ComponentProps<"button"> & { variante?: "primario" | "contorno" | "perigo"; ocupado?: boolean }

const publico = {
  base: "inline-flex min-h-12 w-full items-center justify-center rounded-lg px-6 text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado disabled:cursor-not-allowed disabled:opacity-60",
  primario: "bg-creme text-fundo hover:bg-white",
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
