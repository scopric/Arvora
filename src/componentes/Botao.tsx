import type { ComponentProps } from "react"
import { useT } from "../i18n"

type Props = ComponentProps<"button"> & { variante?: "primario" | "contorno"; ocupado?: boolean }

const estilos = {
  primario: "bg-creme text-fundo hover:bg-white",
  contorno: "border border-creme/30 text-creme hover:border-creme/60",
}

export function Botao({ variante = "primario", ocupado, children, className = "", disabled, ...resto }: Props) {
  const t = useT()
  return (
    <button
      disabled={disabled || ocupado}
      aria-busy={ocupado || undefined}
      className={`inline-flex min-h-12 w-full items-center justify-center rounded-lg px-6 text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado disabled:cursor-not-allowed disabled:opacity-60 ${estilos[variante]} ${className}`}
      {...resto}
    >
      {ocupado ? t("comum.aguarde") : children}
    </button>
  )
}
