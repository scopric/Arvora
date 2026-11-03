import { botaoPequenoApp } from "../../../componentes/botaoEstilo"
import { linkTextoApp } from "../../../componentes/menuApp"

// Link de texto do admin (coluna principal da tabela): o mesmo link de texto do app.
export const classeLink = linkTextoApp
// Rodapé da tabela: "12 linhas"; "300+ linhas" quando a consulta parou no limite e pode haver mais.
export const contagem = (n: number, noLimite: boolean, t: (c: "admin.comum.linha" | "admin.comum.linhas") => string) =>
  `${n}${noLimite ? "+" : ""} ${t(n === 1 ? "admin.comum.linha" : "admin.comum.linhas")}`
// Botão pequeno de ação em linha de tabela (ghost do Linear; 44px no toque).
export const classeAcao = botaoPequenoApp
