import type { ReactNode } from "react"
import { Cartao } from "../../../componentes/Cartao"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import type { Carga } from "../useCarga"

// Um cartão do Início com seu próprio carregando/erro/vazio: uma consulta que falha não derruba as outras.
// Cartão de vidro (Decisão 70); o vazio é uma frase em cinza, sem segunda moldura dentro da primeira.
export function Bloco<T>({ titulo, carga, recarregar, vazio, className = "", children }: { titulo: string; carga: Carga<T>; recarregar: () => void; vazio: string; className?: string; children: (dados: T) => ReactNode }) {
  return (
    <Cartao className={className}>
      <h2 className="text-corpo-p font-semibold text-cinza">{titulo}</h2>
      <div className="mt-4">
        {carga.fase === "carregando" ? <Esqueleto linhas={3} /> : null}
        {carga.fase === "erro" ? <Erro aoTentar={recarregar} /> : null}
        {carga.fase === "ok" ? ((Array.isArray(carga.dados) && carga.dados.length === 0) || carga.dados === null ? <p className="text-corpo text-cinza">{vazio}</p> : children(carga.dados)) : null}
      </div>
    </Cartao>
  )
}
