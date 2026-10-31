import type { ReactNode } from "react"
import { Link } from "react-router"
import { useCaminho, useT, type Chave } from "../../i18n"

// Moldura das telas da área: <h1> no estilo do site e coluna de conteúdo. A tela não renderiza <main> (o layout já tem).
export function Pagina({ titulo, apoio, largura = "max-w-6xl", children }: { titulo: string; apoio?: ReactNode; largura?: string; children: ReactNode }) {
  return (
    <div className={`mx-auto ${largura} px-6 py-12 sm:px-12 lg:py-16`}>
      <h1 className="font-titulo text-5xl leading-none font-bold tracking-tight text-balance uppercase sm:text-6xl">{titulo}</h1>
      {apoio ? <p className="mt-4 max-w-prose text-lg text-creme/80">{apoio}</p> : null}
      <div className="mt-10">{children}</div>
    </div>
  )
}

export const linkBotao =
  "inline-flex min-h-12 items-center justify-center rounded-lg px-6 text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado"
export const linkPrimario = `${linkBotao} bg-creme text-fundo hover:bg-white`
export const linkContorno = `${linkBotao} border border-creme/30 text-creme hover:border-creme/60`

// Registro que não existe (slug errado, despublicado): página própria, sem <main> (o layout já tem), em vez da NaoEncontrada da base.
export function SemRegistro({ voltar, rotulo }: { voltar: string; rotulo: Chave }) {
  const t = useT()
  const caminho = useCaminho()
  return (
    <Pagina titulo={t("publico.semRegistro.titulo")} largura="max-w-3xl">
      <p className="max-w-prose text-lg">{t("publico.semRegistro.texto")}</p>
      <Link to={caminho(voltar)} className={`${linkPrimario} mt-6`}>
        {t(rotulo)}
      </Link>
    </Pagina>
  )
}
