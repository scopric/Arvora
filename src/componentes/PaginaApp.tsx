import type { ReactNode } from "react"
import { useT, useTitulo, type Chave } from "../i18n"
import { LinkVoltar } from "./LinkVoltar"

// Moldura das telas do app (Aprender, Rede): <title>, <h1> e largura (1280 do MasterClass). Sem <main>: o layout já
// tem (id="conteudo"). `voltar` = link acima do título; `rotulo` = eyebrow em cinza; `conteudo` = título em Big
// Shoulders (só nome de conteúdo: curso, aula, premiado); `meta` = linha em cinza sob o título; `intro` = parágrafo
// de apoio; `acoes` = atalhos (pílulas de categoria); `estreita` = coluna de leitura (feed, perfil); `capa` = herói
// do MasterClass (página da classe): a imagem atrás do cabeçalho, escurecendo para o palco onde fica o texto.
export function PaginaApp({ chave, titulo, rotulo, conteudo, meta, intro, voltar, acoes, estreita, capa, children }: {
  chave: Chave
  titulo?: string
  rotulo?: string
  conteudo?: boolean
  meta?: ReactNode
  intro?: string
  voltar?: { para: string; rotulo: string }
  acoes?: ReactNode
  estreita?: boolean
  capa?: string | null
  children: ReactNode
}) {
  const t = useT()
  useTitulo(chave, true)
  const cabecalho = (
    <>
      {voltar ? <LinkVoltar {...voltar} /> : null}
      {rotulo ? <p className="mb-2 text-corpo-p font-semibold text-cinza">{rotulo}</p> : null}
      <h1 className={conteudo ? "font-conteudo text-titulo-g font-[500] tracking-normal break-words text-balance uppercase lg:text-conteudo" : "text-titulo-p font-semibold sm:text-titulo"}>
        {titulo ?? t(chave)}
      </h1>
      {conteudo && capa ? <span aria-hidden="true" className="mt-4 block h-0.5 w-10 rounded-full bg-dourado" /> : null}
      {meta ? <p className="mt-3 text-corpo-p text-cinza">{meta}</p> : null}
      {intro ? <p className="mt-3 max-w-prose text-corpo text-cinza">{intro}</p> : null}
      {acoes ? <div className="mt-5 flex flex-wrap gap-2">{acoes}</div> : null}
    </>
  )
  return (
    <div className={`mx-auto px-4 py-8 sm:px-6 lg:py-12 ${estreita ? "max-w-3xl" : "max-w-[1280px]"}`}>
      {capa ? (
        <div className="relative overflow-hidden rounded-xl">
          <img src={capa} alt="" className="absolute inset-0 size-full object-cover" />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-breu via-breu/85 to-breu/30" />
          <div className="relative max-w-2xl px-6 py-10 sm:px-8 lg:min-h-96 lg:py-16">{cabecalho}</div>
        </div>
      ) : (
        cabecalho
      )}
      <div className="mt-8">{children}</div>
    </div>
  )
}

// Moldura sem <h1> próprio, para telas que compõem o cabeçalho dentro de uma grade (player com painel ao lado).
export function MolduraApp({ chave, children }: { chave: Chave; children: ReactNode }) {
  useTitulo(chave, true)
  return <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 lg:py-12">{children}</div>
}
