import { botaoPequenoApp } from "../../../componentes/botaoEstilo"
import { caixaSutilApp, cartaoApp } from "../../../componentes/Cartao"
import { linkTextoApp } from "../../../componentes/menuApp"

// Link de texto do admin (coluna principal da tabela): o mesmo link de texto do app, com 44px de alvo no toque.
export const classeLink = `inline-flex items-center pointer-coarse:min-h-11 ${linkTextoApp}`
// Rodapé da tabela: "12 linhas"; "300+ linhas" quando a consulta parou no limite e pode haver mais.
export const contagem = (n: number, noLimite: boolean, t: (c: "admin.comum.linha" | "admin.comum.linhas") => string) =>
  `${n}${noLimite ? "+" : ""} ${t(n === 1 ? "admin.comum.linha" : "admin.comum.linhas")}`
// Botão pequeno de ação em linha de tabela (ghost do Linear; 44px no toque).
export const classeAcao = botaoPequenoApp
// Caixa sutil em ardósia (Decisão 70) para subblocos dentro de um cartão de vidro e painéis de ações.
export const caixaSutilAdmin = caixaSutilApp
// Cartão de vidro para <form>/<section> do admin (o mesmo do Cartao).
export const cartaoAdmin = cartaoApp
// Célula de número (molde Dock/Intercom): rótulo 14 em cinza, número grande 600 tabular, num bloco de vidro-fundo.
export const celulaNumeroAdmin = "rounded-lg p-5 vidro-fundo"
