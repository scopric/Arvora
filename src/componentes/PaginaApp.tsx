import type { ReactNode } from "react"
import { useT, useTitulo, type Chave } from "../i18n"
import { LinkVoltar } from "./LinkVoltar"

// Moldura das telas do app (Aprender, Rede): <title>, <h1> e largura. Sem <main>: o layout já tem (id="conteudo").
// `voltar` = link acima do título; `rotulo` = eyebrow em névoa; `conteudo` = título em Big Shoulders (só nome de conteúdo,
// padrão MasterClass: curso, aula); `meta` = linha em névoa sob o título; `intro` = parágrafo de apoio; `acoes` = atalhos
// (molde Mercury); `estreita` = coluna de leitura (feed, perfil).
export function PaginaApp({ chave, titulo, rotulo, conteudo, meta, intro, voltar, acoes, estreita, children }: {
  chave: Chave
  titulo?: string
  rotulo?: string
  conteudo?: boolean
  meta?: ReactNode
  intro?: string
  voltar?: { para: string; rotulo: string }
  acoes?: ReactNode
  estreita?: boolean
  children: ReactNode
}) {
  const t = useT()
  useTitulo(chave, true)
  return (
    <div className={`mx-auto px-4 py-8 sm:px-6 ${estreita ? "max-w-3xl" : "max-w-5xl"}`}>
      {voltar ? <LinkVoltar {...voltar} /> : null}
      {rotulo ? <p className="mb-2 text-corpo-p font-medium text-nevoa">{rotulo}</p> : null}
      <h1 className={conteudo ? "font-conteudo text-titulo leading-none font-normal tracking-normal text-balance sm:text-titulo-g lg:text-conteudo" : "text-titulo-p font-semibold sm:text-titulo"}>
        {titulo ?? t(chave)}
      </h1>
      {meta ? <p className="mt-3 text-corpo-p text-nevoa">{meta}</p> : null}
      {intro ? <p className="mt-3 max-w-prose text-base text-nevoa">{intro}</p> : null}
      {acoes ? <div className="mt-5 flex flex-wrap gap-2">{acoes}</div> : null}
      <div className="mt-8">{children}</div>
    </div>
  )
}
