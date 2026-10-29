import type { Chave } from "../i18n"
import { supabase } from "./supabase"

const ERRO = "perfil.dados.erro"

// Baixa o JSON com os dados pessoais do titular (GDPR art. 15/20). Devolve a chave da mensagem de erro, ou null se deu certo.
export async function baixarMeusDados(): Promise<Chave | null> {
  const { data, error } = await supabase.rpc("exportar_meus_dados")
  if (error || !data) return ERRO
  const d = new Date()
  const dia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }))
  const a = document.createElement("a")
  a.href = url
  a.download = `arvora-meus-dados-${dia}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revogar na hora pode cancelar o download em alguns navegadores (Safari, Firefox antigos).
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return null
}
