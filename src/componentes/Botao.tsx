import type { ComponentProps } from "react"
import { useT } from "../i18n"
import { useApp } from "./escopo"

type Props = ComponentProps<"button"> & { variante?: "primario" | "contorno" | "perigo"; ocupado?: boolean }

const publico = {
  base: "inline-flex min-h-12 w-full items-center justify-center rounded-lg px-6 text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado disabled:cursor-not-allowed disabled:opacity-60",
  primario: "bg-creme text-fundo hover:bg-white",
  contorno: "border border-creme/30 text-creme hover:border-creme/60",
  perigo: "bg-red-200 text-red-950 hover:bg-red-100",
}

// App (Linear): primário = o único botão cromático da tela (dourado, raio 6, 14px/510); contorno = ghost com hairline;
// perigo = ghost vermelho. Largura automática; 36px de altura, 44 no toque.
const app = {
  base: "inline-flex min-h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors pointer-coarse:min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado disabled:cursor-not-allowed disabled:opacity-60",
  primario: "bg-dourado text-breu hover:brightness-110",
  contorno: "border border-grafite text-bruma hover:bg-creme/5 hover:text-creme",
  perigo: "border border-red-300/30 text-red-300 hover:bg-red-300/10",
}

export function Botao({ variante = "primario", ocupado, children, className = "", disabled, ...resto }: Props) {
  const t = useT()
  const e = useApp() ? app : publico
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
