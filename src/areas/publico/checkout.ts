import { FunctionsHttpError } from "@supabase/supabase-js"
import type { Chave } from "../../i18n"
import type { Idioma } from "../../site"
import { supabase } from "../../lib/supabase"

// Versão do texto do aceite que a tela mostra (Decisão 50). Vai no corpo como `aceite: { versao }`; o servidor
// (stripe-checkout, branch aceite-checkout) exige /^[A-Za-z0-9._-]{1,32}$/ e guarda a prova. Mudou o texto das duas
// confirmações em publico.pt.ts/en.ts? Mude esta versão junto.
// PROVISÓRIO: validar com o solicitor.
export const VERSAO_ACEITE = "ass10-prov-1"

const HOSTS = ["checkout.stripe.com"]

// Igual a iniciarCheckout de src/lib/assinatura.ts, mais o corpo `aceite`. A base ainda não aceita esse parâmetro:
// quando aceitar, esta função some e a tela volta a chamar a da base.
// Devolve a chave da mensagem de erro (ou null se foi para o Stripe). Só segue para o Stripe em https.
export async function iniciarCheckoutComAceite(planoId: number, idioma: Idioma): Promise<Chave | null> {
  const { data, error } = await supabase.functions.invoke<{ url?: unknown }>("stripe-checkout", {
    body: { plano_id: planoId, idioma, aceite: { versao: VERSAO_ACEITE } },
  })
  if (error instanceof FunctionsHttpError) {
    const { status } = error.context
    if (status === 429) return "publico.planos.erroLimite"
    if (status === 409) return "publico.planos.erroJaAssina"
  }
  const url = typeof data?.url === "string" && URL.canParse(data.url) ? new URL(data.url) : null
  if (error || url?.protocol !== "https:" || !HOSTS.includes(url.hostname)) return "publico.planos.erroCheckout"
  window.location.assign(url.href)
  return null
}
