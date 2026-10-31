import { useAcesso, type PapelEquipe } from "../../../lib/acesso"

// Quem pode escrever o quê (espelha o RLS; o banco é quem barra de verdade, aqui só escolhemos o que mostrar).
export const EDITA: PapelEquipe[] = ["super_admin", "editor"]
export const MODERA: PapelEquipe[] = ["super_admin", "moderador"]
export const CORRIGE: PapelEquipe[] = ["super_admin", "corretor"]
export const FINANCEIRO: PapelEquipe[] = ["super_admin", "auditor"]
export const SUPER: PapelEquipe[] = ["super_admin"]
export const APROVA_EMPRESA: PapelEquipe[] = ["super_admin", "editor", "moderador"]

export function usePode(papeis: PapelEquipe[]) {
  const { papel } = useAcesso()
  return papel !== null && papeis.includes(papel)
}
