import { useT } from "../../../i18n"
import type { OpcaoSel } from "../componentes/FormularioRegistro"

export const opcoesDe = (linhas: Record<string, unknown>[], valor = "id", texto = "nome"): OpcaoSel[] =>
  linhas.map((l) => ({ valor: String(l[valor]), texto: String(l[texto]) }))

export function useOpcoesNivel(): OpcaoSel[] {
  const t = useT()
  return [
    { valor: "visitante", texto: t("nivel.visitante") },
    { valor: "clube", texto: t("nivel.clube") },
    { valor: "grupo", texto: t("nivel.grupo") },
  ]
}
