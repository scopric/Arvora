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

// App (molde Attio sobre os tokens do MasterClass): bloco carvão sem borda, cabeçalho 14px/600 cinza sem fundo,
// divisórias em placa, hover sutil, números tabulares.
const app = {
  regiao: "overflow-x-auto rounded-lg vidro-fundo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado",
  tabela: "w-full min-w-max text-left text-corpo-p",
  cabecalho: "border-b border-placa",
  th: "px-4 py-3 text-corpo-p font-semibold text-cinza",
  corpo: "divide-y divide-placa",
  linha: "hover:bg-creme/3",
  td: "px-4 py-3 tabular-nums",
}

// Tabela simples: <table> de verdade (cabeçalho com scope), rolagem lateral no celular dentro de região focável (teclado alcança).
// `id` da linha para a key; `legenda` fica visível para leitor de tela (sr-only). `contagem` = rodapé "N linhas" (molde Attio), só no app.
export function Tabela<L>({ colunas, linhas, id, legenda, contagem }: { colunas: Coluna<L>[]; linhas: L[]; id: (linha: L) => string | number; legenda: string; contagem?: string }) {
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
      {contagem ? <p className="sticky left-0 border-t border-placa px-4 py-2 text-legenda text-cinza tabular-nums">{contagem}</p> : null}
    </div>
  )
}
