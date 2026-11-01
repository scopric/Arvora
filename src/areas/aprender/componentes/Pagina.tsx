import type { ReactNode } from "react"
import { useT, useTitulo, type Chave } from "../../../i18n"

// Moldura das telas da área: <title>, <h1> e largura. Sem <main>: o layout já tem (id="conteudo").
export function Pagina({ chave, titulo, rotulo, children }: { chave: Chave; titulo?: string; rotulo?: string; children: ReactNode }) {
  const t = useT()
  useTitulo(chave, true)
  return (
    <div className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
      {rotulo ? <p className="mb-2 font-mono text-xs font-semibold tracking-[0.2em] text-destaque uppercase">{rotulo}</p> : null}
      <h1 className="text-subtitulo font-semibold sm:text-titulo-p">{titulo ?? t(chave)}</h1>
      <div className="mt-8">{children}</div>
    </div>
  )
}
