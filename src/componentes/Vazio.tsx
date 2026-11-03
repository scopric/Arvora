import type { ReactNode } from "react"
import { useApp } from "./escopo"

// Estado vazio: frase curta que diz o que fazer (microcopy do PRD §17.8). `acao` = botão/link opcional.
export function Vazio({ titulo, children, acao }: { titulo?: string; children: ReactNode; acao?: ReactNode }) {
  const app = useApp()
  return (
    <div className={app ? "rounded-lg px-6 py-12 text-center vidro-fundo" : "rounded-2xl border border-current/15 px-6 py-12 text-center"}>
      {titulo ? <h2 className={app ? "text-subtitulo font-semibold" : "font-titulo text-3xl font-normal"}>{titulo}</h2> : null}
      <p className={`mx-auto max-w-prose ${app ? "text-corpo text-cinza" : "opacity-75"} ${titulo ? "mt-3" : ""}`}>{children}</p>
      {acao ? <div className="mt-6 flex justify-center">{acao}</div> : null}
    </div>
  )
}
