import type { ReactNode } from "react"
import { useT, useTitulo, type Chave } from "../../../i18n"
import { Vazio } from "../../../componentes/Vazio"
import { Aviso } from "../../../componentes/Aviso"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import type { AvisoAcao, Carga } from "../lib/consulta"

// Casca de toda tela do admin: <h1> + título da aba. A tela não renderiza <main> (o LayoutAdmin tem).
export function Pagina({ titulo, intro, acoes, children }: { titulo: Chave; intro?: Chave; acoes?: ReactNode; children: ReactNode }) {
  const t = useT()
  useTitulo(titulo, true)
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-titulo text-4xl leading-none font-normal text-balance sm:text-5xl">{t(titulo)}</h1>
          {intro ? <p className="mt-3 max-w-prose opacity-75">{t(intro)}</p> : null}
        </div>
        {acoes}
      </div>
      <div className="mt-8 space-y-8">{children}</div>
    </div>
  )
}

export function Secao({ titulo, children }: { titulo: Chave; children: ReactNode }) {
  const t = useT()
  return (
    <section>
      <h2 className="mb-4 font-titulo text-2xl font-normal">{t(titulo)}</h2>
      {children}
    </section>
  )
}

// Esqueleto enquanto carrega, erro com "tentar de novo" se falhar; só então os dados.
export function Mostrar<T>({ carga, children }: { carga: Carga<T>; children: (dados: T) => ReactNode }) {
  const t = useT()
  if (carga.fase === "carregando") return <Esqueleto linhas={4} />
  if (carga.fase === "erro") return <Erro aoTentar={carga.recarregar}>{t("admin.erro.carregar")}</Erro>
  return <>{children(carga.dados)}</>
}

export function SemPermissao() {
  const t = useT()
  return <Vazio titulo={t("admin.semPermissao.titulo")}>{t("admin.semPermissao.texto")}</Vazio>
}

export function AvisoDe({ aviso }: { aviso: AvisoAcao }) {
  return aviso ? <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso> : null
}
