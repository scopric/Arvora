import { botaoPrimarioApp } from "../../../componentes/botaoEstilo"

// Ação primária de uma lista (ex.: "Nova aula"): o único botão dourado da tela, na barra acima da tabela.
export const classeAcaoPrimaria = botaoPrimarioApp
// Link de texto do admin (coluna principal da tabela, "voltar"): creme, sublinhado em cinza que acende no hover.
export const classeLink = "rounded-sm font-medium text-creme underline decoration-cinza underline-offset-4 transition-colors hover:decoration-creme focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado"
// Rodapé da tabela: "12 linhas"; "300+ linhas" quando a consulta parou no limite e pode haver mais.
export const contagem = (n: number, noLimite: boolean, t: (c: "admin.comum.linha" | "admin.comum.linhas") => string) =>
  `${n}${noLimite ? "+" : ""} ${t(n === 1 ? "admin.comum.linha" : "admin.comum.linhas")}`
