import type { ReactNode } from "react"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { Vazio } from "../../../componentes/Vazio"
import type { Carga } from "../useCarga"

// Um bloco do Início com seu próprio carregando/erro/vazio: uma consulta que falha não derruba as outras.
export function Bloco<T>({ titulo, carga, recarregar, vazio, children }: { titulo: string; carga: Carga<T>; recarregar: () => void; vazio: string; children: (dados: T) => ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="font-titulo text-2xl font-bold uppercase">{titulo}</h2>
      {carga.fase === "carregando" ? <Esqueleto linhas={3} /> : null}
      {carga.fase === "erro" ? <Erro aoTentar={recarregar} /> : null}
      {carga.fase === "ok" ? (Array.isArray(carga.dados) && carga.dados.length === 0 ? <Vazio>{vazio}</Vazio> : carga.dados === null ? <Vazio>{vazio}</Vazio> : children(carga.dados)) : null}
    </section>
  )
}
