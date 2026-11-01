import type { ReactNode } from "react"
import { Link } from "react-router"
import { Icone } from "../../../componentes/Icone"
import { useT, useTitulo, type Chave } from "../../../i18n"
import { foco } from "../util"

// Moldura das telas da área: <title>, <h1> e largura. Sem <main>: o layout já tem (id="conteudo").
// `voltar` = link acima do título; `rotulo` = eyebrow em névoa; `conteudo` = título em Big Shoulders (só nome de conteúdo,
// padrão MasterClass: curso, aula); `meta` = linha em névoa sob o título; `acoes` = atalhos (molde Mercury).
export function Pagina({ chave, titulo, rotulo, conteudo, meta, voltar, acoes, children }: {
  chave: Chave
  titulo?: string
  rotulo?: string
  conteudo?: boolean
  meta?: ReactNode
  voltar?: { para: string; rotulo: string }
  acoes?: ReactNode
  children: ReactNode
}) {
  const t = useT()
  useTitulo(chave, true)
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {voltar ? (
        <Link to={voltar.para} className={`mb-4 inline-flex min-h-9 items-center gap-1 rounded-sm text-legenda font-medium text-nevoa transition-colors hover:text-creme ${foco}`}>
          <Icone nome="seta" className="size-4" />
          {voltar.rotulo}
        </Link>
      ) : null}
      {rotulo ? <p className="mb-2 text-legenda font-medium text-nevoa">{rotulo}</p> : null}
      <h1 className={conteudo ? "font-conteudo text-titulo-p leading-[0.95] font-semibold tracking-normal uppercase sm:text-titulo lg:text-titulo-g" : "text-subtitulo font-semibold sm:text-titulo-p"}>
        {titulo ?? t(chave)}
      </h1>
      {meta ? <p className="mt-3 text-legenda text-nevoa">{meta}</p> : null}
      {acoes ? <div className="mt-5 flex flex-wrap gap-2">{acoes}</div> : null}
      <div className="mt-8">{children}</div>
    </div>
  )
}
