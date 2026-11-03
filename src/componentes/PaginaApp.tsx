import type { ReactNode } from "react"
import { useT, useTitulo, type Chave } from "../i18n"
import { LinkVoltar } from "./LinkVoltar"

// Moldura das telas do app (Aprender, Rede): <title>, <h1> e largura (1280 do MasterClass). Sem <main>: o layout já
// tem (id="conteudo"). `voltar` = link acima do título; `rotulo` = eyebrow em cinza; `conteudo` = título em Big
// Shoulders (só nome de conteúdo: curso, aula, premiado); `meta` = linha em cinza sob o título; `intro` = parágrafo
// de apoio; `acoes` = atalhos (pílulas de categoria); `estreita` = coluna de leitura (feed, perfil).
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
    <div className={`mx-auto px-4 py-8 sm:px-6 lg:py-12 ${estreita ? "max-w-3xl" : "max-w-[1280px]"}`}>
      {voltar ? <LinkVoltar {...voltar} /> : null}
      {rotulo ? <p className="mb-2 text-corpo-p font-semibold text-cinza">{rotulo}</p> : null}
      <h1 className={conteudo ? "font-conteudo text-titulo-g font-[500] tracking-normal text-balance uppercase lg:text-conteudo" : "text-titulo-p font-semibold sm:text-titulo"}>
        {titulo ?? t(chave)}
      </h1>
      {meta ? <p className="mt-3 text-corpo-p text-cinza">{meta}</p> : null}
      {intro ? <p className="mt-3 max-w-prose text-corpo text-cinza">{intro}</p> : null}
      {acoes ? <div className="mt-5 flex flex-wrap gap-2">{acoes}</div> : null}
      <div className="mt-8">{children}</div>
    </div>
  )
}
