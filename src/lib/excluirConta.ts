import { FunctionsHttpError } from "@supabase/supabase-js"
import { sair } from "./sessao"
import { supabase } from "./supabase"

const MENSAGENS: Record<string, string> = {
  email_diferente: "O e-mail digitado não é o e-mail da sua conta.",
  senha_invalida: "Senha incorreta.",
  mfa_requerido: "Sua conta tem verificação em duas etapas. Entre de novo confirmando o segundo fator para excluir.",
  equipe: "Sua conta tem papel na equipe. Peça a um administrador para removê-lo antes de excluir a conta.",
  stripe: "Não conseguimos cancelar sua assinatura agora, então nada foi excluído. Tente de novo em instantes.",
  exclusao: "Sua assinatura foi cancelada, mas não conseguimos excluir a conta. Tente de novo; se persistir, escreva para o suporte.",
}
const GENERICA = "Não conseguimos excluir sua conta agora. Tente de novo; se persistir, escreva para o suporte."

// Devolve a mensagem de erro (nunca silêncio, Erros 3.2) ou null se a conta foi excluída e a sessão encerrada.
export async function excluirMinhaConta(email: string, senha: string): Promise<string | null> {
  const { error } = await supabase.functions.invoke("excluir-conta", { body: { email, senha } })
  if (error) {
    const codigo = error instanceof FunctionsHttpError
      ? await error.context.json().then((j: { erro?: unknown }) => j?.erro, () => undefined)
      : undefined
    return (typeof codigo === "string" && MENSAGENS[codigo]) || GENERICA
  }
  await sair()
  return null
}
