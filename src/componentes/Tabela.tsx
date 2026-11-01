import type { ReactNode } from "react"
import { useT } from "../i18n"

export type Coluna<L> = { chave: string; titulo: string; celula: (linha: L) => ReactNode }

// Tabela simples: <table> de verdade (cabeçalho com scope), rolagem lateral no celular dentro de região focável (teclado alcança).
// `id` da linha para a key; `legenda` fica visível para leitor de tela (sr-only).
export function Tabela<L>({ colunas, linhas, id, legenda }: { colunas: Coluna<L>[]; linhas: L[]; id: (linha: L) => string | number; legenda: string }) {
  const t = useT()
  return (
    <div role="region" aria-label={`${legenda}. ${t("comum.tabelaRolavel")}`} tabIndex={0} className="overflow-x-auto rounded-xl border border-current/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado">
      <table className="w-full min-w-max text-left text-sm">
        <caption className="sr-only">{legenda}</caption>
        <thead className="border-b border-current/15 bg-current/5">
          <tr>
            {colunas.map((c) => (
              <th key={c.chave} scope="col" className="px-4 py-3 font-semibold">
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-current/10">
          {linhas.map((l) => (
            <tr key={id(l)}>
              {colunas.map((c) => (
                <td key={c.chave} className="px-4 py-3">
                  {c.celula(l)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
