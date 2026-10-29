import { FunctionsHttpError } from "@supabase/supabase-js"
import type { Chave } from "../i18n"
import { sair } from "./sessao"
import { supabase } from "./supabase"

const CHAVES: Record<string, Chave> = {
  email_diferente: "erro.excluir.email_diferente",
  senha_invalida: "erro.excluir.senha_invalida",
  mfa_requerido: "erro.excluir.mfa_requerido",
  equipe: "erro.excluir.equipe",
  stripe: "erro.excluir.stripe",
  exclusao: "erro.excluir.exclusao",
  limite: "perfil.excluir.erroLimite",
}

// Devolve a chave da mensagem de erro (nunca silêncio, Erros 3.2) ou null se a conta foi excluída e a sessão encerrada.
export async function excluirMinhaConta(email: string, senha: string): Promise<Chave | null> {
  const { error } = await supabase.functions.invoke("excluir-conta", { body: { email, senha } })
  if (error) {
    const codigo = error instanceof FunctionsHttpError
      ? await error.context.json().then((j: { erro?: unknown }) => j?.erro, () => undefined)
      : undefined
    if (error instanceof FunctionsHttpError && error.context.status === 429) return CHAVES.limite
    return (typeof codigo === "string" && CHAVES[codigo]) || "erro.excluir.default"
  }
  await sair()
  return null
}
