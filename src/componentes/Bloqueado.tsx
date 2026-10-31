import { Link } from "react-router"
import type { ReactNode } from "react"
import { useCaminho, useT } from "../i18n"
import type { Nivel } from "../lib/acesso"
import { Icone } from "./Icone"

// Cadeado elegante (PRD §17.1): prévia real borrada (aria-hidden, nunca lida), frase de upgrade e botão para /planos.
// `previa` = o conteúdo real (capa, título, trecho); `frase` = a frase do microcopy daquela tela; `minimo` escolhe o rótulo.
export function Bloqueado({ previa, frase, minimo = "grupo" }: { previa?: ReactNode; frase: string; minimo?: Exclude<Nivel, "visitante"> }) {
  const t = useT()
  const caminho = useCaminho()
  const grupo = minimo === "grupo"
  return (
    <section aria-label={t(grupo ? "bloqueado.rotulo" : "bloqueado.rotuloClube")} className="relative overflow-hidden rounded-2xl border border-current/15">
      {previa ? (
        <div aria-hidden="true" inert className="pointer-events-none max-h-72 overflow-hidden p-6 blur-sm select-none">
          {previa}
        </div>
      ) : null}
      <div className={`flex flex-col items-start gap-4 p-6 ${previa ? "absolute inset-0 justify-end bg-gradient-to-t from-fundo via-fundo/80 to-transparent" : ""}`}>
        <p className="flex items-center gap-2 font-mono text-xs font-semibold tracking-[0.2em] text-destaque uppercase">
          <Icone nome="cadeado" className="size-4" />
          {t(grupo ? "bloqueado.rotulo" : "bloqueado.rotuloClube")}
        </p>
        <p className="max-w-prose text-lg">{frase}</p>
        <Link to={caminho("/planos")} className="inline-flex min-h-12 items-center justify-center rounded-lg bg-creme px-6 font-semibold text-fundo transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado">
          {t(grupo ? "bloqueado.upgrade" : "bloqueado.upgradeClube")}
        </Link>
      </div>
    </section>
  )
}
