import type { ReactNode } from "react"
import { useT, useTitulo, type Chave } from "../../../i18n"

// Moldura das telas da área: <title>, <h1> e largura. Sem <main>: o layout já tem (id="conteudo").
// `rotulo` = eyebrow em névoa (molde Linear); `acoes` = linha de atalhos logo abaixo do título (molde Mercury).
export function Pagina({ chave, titulo, rotulo, acoes, children }: { chave: Chave; titulo?: string; rotulo?: string; acoes?: ReactNode; children: ReactNode }) {
  const t = useT()
  useTitulo(chave, true)
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {rotulo ? <p className="mb-2 text-legenda font-medium text-nevoa">{rotulo}</p> : null}
      <h1 className="text-subtitulo font-semibold sm:text-titulo-p">{titulo ?? t(chave)}</h1>
      {acoes ? <div className="mt-5 flex flex-wrap gap-2">{acoes}</div> : null}
      <div className="mt-8">{children}</div>
    </div>
  )
}
