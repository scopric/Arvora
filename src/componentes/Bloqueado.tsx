import { Link } from "react-router"
import type { ReactNode } from "react"
import { useCaminho, useT } from "../i18n"
import type { Nivel } from "../lib/acesso"
import { botaoPublico, botaoSecundarioApp } from "./botaoEstilo"
import { useApp } from "./escopo"
import { Icone } from "./Icone"

// Cadeado elegante (PRD §17.1): prévia real borrada (aria-hidden, nunca lida), frase de upgrade e botão para /planos.
// `previa` = o conteúdo real (capa, título, trecho); `frase` = a frase do microcopy daquela tela; `minimo` escolhe o rótulo.
export function Bloqueado({ previa, frase, minimo = "grupo" }: { previa?: ReactNode; frase: string; minimo?: Exclude<Nivel, "visitante"> }) {
  const t = useT()
  const caminho = useCaminho()
  const app = useApp()
  const grupo = minimo === "grupo"
  const rotulo = t(grupo ? "bloqueado.rotulo" : "bloqueado.rotuloClube")
  const cta = t(grupo ? "bloqueado.upgrade" : "bloqueado.upgradeClube")
  if (app) {
    // App (MasterClass): bloco carvão; o véu é uma faixa sólida em ardósia no rodapé com hairline em cima, sem degradê.
    // O CTA do cadeado é secundário (cinza): o único dourado da tela continua sendo a ação principal dela (Decisão 70).
    return (
      <section aria-label={rotulo} className="grid overflow-hidden rounded-lg vidro-fundo">
        {/* Prévia e faixa dividem a mesma célula do grid: o bloco cresce até a faixa caber, mesmo com prévia baixa. */}
        {previa ? (
          <div aria-hidden="true" inert className="pointer-events-none [grid-area:1/1] max-h-72 overflow-hidden p-6 blur-sm select-none">
            {previa}
          </div>
        ) : null}
        <div className={`flex flex-col items-start gap-4 p-6 ${previa ? "relative [grid-area:1/1] self-end border-t border-placa bg-ardosia" : ""}`}>
          <p className="flex items-center gap-2 text-corpo-p font-semibold text-cinza">
            <Icone nome="cadeado" className="size-4" />
            {rotulo}
          </p>
          <p className="max-w-prose text-corpo">{frase}</p>
          <Link to={caminho("/planos")} className={botaoSecundarioApp}>
            {cta}
          </Link>
        </div>
      </section>
    )
  }
  return (
    <section aria-label={rotulo} className="relative overflow-hidden rounded-2xl border border-current/15">
      {previa ? (
        <div aria-hidden="true" inert className="pointer-events-none max-h-72 overflow-hidden p-6 blur-sm select-none">
          {previa}
        </div>
      ) : null}
      <div className={`flex flex-col items-start gap-4 p-6 ${previa ? "absolute inset-0 justify-end bg-gradient-to-t from-fundo via-fundo/80 to-transparent" : ""}`}>
        <p className="flex items-center gap-2 font-mono text-xs font-semibold tracking-[0.2em] text-destaque uppercase">
          <Icone nome="cadeado" className="size-4" />
          {rotulo}
        </p>
        <p className="max-w-prose text-lg">{frase}</p>
        <Link to={caminho("/planos")} className={`${botaoPublico} bg-destaque text-fundo hover:shadow-brilho`}>
          {cta}
        </Link>
      </div>
    </section>
  )
}
