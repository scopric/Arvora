import type { ReactNode } from "react"
import { useT } from "../i18n"
import { useApp } from "./escopo"

export type Coluna<L> = { chave: string; titulo: string; celula: (linha: L) => ReactNode }

const publico = {
  regiao: "overflow-x-auto rounded-xl border border-current/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado",
  tabela: "w-full min-w-max text-left text-sm",
  cabecalho: "border-b border-current/15 bg-current/5",
  th: "px-4 py-3 font-semibold",
  corpo: "divide-y divide-current/10",
  linha: "",
  td: "px-4 py-3",
}

// App (molde Attio/Linear): hairline grafite, cabeçalho 12px/510 névoa sem fundo, linhas compactas com hover sutil, números tabulares.
const app = {
  regiao: "overflow-x-auto rounded-xl border border-grafite focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado",
  tabela: "w-full min-w-max text-left text-legenda",
  cabecalho: "border-b border-grafite",
  th: "px-4 py-2.5 text-xs font-medium text-nevoa",
  corpo: "divide-y divide-grafite",
  linha: "hover:bg-creme/2",
  td: "px-4 py-2.5 tabular-nums",
}

// Tabela simples: <table> de verdade (cabeçalho com scope), rolagem lateral no celular dentro de região focável (teclado alcança).
// `id` da linha para a key; `legenda` fica visível para leitor de tela (sr-only).
export function Tabela<L>({ colunas, linhas, id, legenda }: { colunas: Coluna<L>[]; linhas: L[]; id: (linha: L) => string | number; legenda: string }) {
  const t = useT()
  const e = useApp() ? app : publico
  return (
    <div role="region" aria-label={`${legenda}. ${t("comum.tabelaRolavel")}`} tabIndex={0} className={e.regiao}>
      <table className={e.tabela}>
        <caption className="sr-only">{legenda}</caption>
        <thead className={e.cabecalho}>
          <tr>
            {colunas.map((c) => (
              <th key={c.chave} scope="col" className={e.th}>
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={e.corpo}>
          {linhas.map((l) => (
            <tr key={id(l)} className={e.linha || undefined}>
              {colunas.map((c) => (
                <td key={c.chave} className={e.td}>
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
