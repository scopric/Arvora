import type { Idioma } from "../site"
import { supabase } from "./supabase"

const HOSTS = ["checkout.stripe.com", "billing.stripe.com"]

// Chama a Edge Function e segue para o Stripe. Erro volta como mensagem para a tela (Erros 3.2), nunca silêncio.
async function irPara(funcao: string, corpo: Record<string, unknown>): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke<{ url?: unknown }>(funcao, { body: corpo })
  // Só segue para as páginas do Stripe em https: nada de redirecionar para o que vier sem conferir.
  const url = typeof data?.url === "string" && URL.canParse(data.url) ? new URL(data.url) : null
  if (error || url?.protocol !== "https:" || !HOSTS.includes(url.hostname)) {
    return "Não conseguimos abrir a página de pagamento agora. Tente de novo; se persistir, escreva para o suporte."
  }
  window.location.assign(url.href)
  return null
}

export const abrirPortal = (idioma: Idioma) => irPara("stripe-portal", { idioma })
export const iniciarCheckout = (planoId: number, idioma: Idioma) => irPara("stripe-checkout", { plano_id: planoId, idioma })
