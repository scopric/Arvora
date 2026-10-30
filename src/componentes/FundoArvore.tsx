import { useState } from "react"
import { useT } from "../i18n"
import { gerar, PASSO } from "./arvoreRede"

const { fios, nos } = gerar()

const vars = (o: Record<string, string>) => o as React.CSSProperties

// Fundo decorativo: árvore feita de rede. `className` posiciona o conjunto; `camada` dimensiona a árvore.
export function FundoArvore({ className = "", camada = "" }: { className?: string; camada?: string }) {
  const t = useT()
  const [parado, setParado] = useState(false)
  return (
    <div data-parado={parado ? "" : undefined} className={`pointer-events-none absolute inset-0 ${className}`}>
      <div aria-hidden="true" className={`fa-mascara absolute inset-y-0 right-0 -z-10 ${camada}`}>
        <svg viewBox="0 0 400 600" preserveAspectRatio="xMidYMax meet" focusable="false" className="pointer-events-none size-full">
          <g fill="none" strokeLinecap="round" className="stroke-creme">
            {fios.map((p, i) => (
              <path key={i} d={p.d} pathLength={1} className="fa-fio" strokeWidth={p.larg} strokeOpacity={p.op} style={vars({ "--d": `${p.prof * PASSO}s` })} />
            ))}
          </g>
          {nos.map((n, i) => (
            <circle
              key={i}
              cx={n.x}
              cy={n.y}
              r={n.r}
              className={`fa-no ${n.ouro ? "fill-dourado" : "fill-destaque"}`}
              style={vars({ "--d": `${n.prof * PASSO}s`, "--r": `${n.ciclo}s`, "--o": `${n.fase}s` })}
            />
          ))}
        </svg>
      </div>
      <button
        type="button"
        onClick={() => setParado(!parado)}
        className="pointer-events-auto absolute right-4 bottom-4 z-10 inline-flex motion-reduce:hidden size-11 items-center justify-center rounded-lg text-creme/80 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado"
      >
        <span className="sr-only">{t(parado ? "fundo.continuar" : "fundo.pausar")}</span>
        <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className="size-5" fill="currentColor">
          {parado ? <path d="M8 5v14l11-7z" /> : <path d="M6 5h4v14H6zM14 5h4v14h-4z" />}
        </svg>
      </button>
    </div>
  )
}
