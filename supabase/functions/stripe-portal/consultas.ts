import { dados, type Sb, usuarioDoJwt } from "../_shared/supabase-usuario.ts"
import type { Consultas } from "./handler.ts"

export const consultas = (sb: Sb): Consultas => ({
  usuario: () => usuarioDoJwt(sb),
  // perfil_id explícito sempre, com ou sem conta: não depender só do RLS.
  cliente: async (uid, conta) => {
    let q = sb.from("clientes_stripe").select("conta_stripe_id, stripe_customer_id").eq("perfil_id", uid)
    if (conta !== undefined) q = q.eq("conta_stripe_id", conta)
    return dados(await q.order("criado_em", { ascending: false }).limit(1).maybeSingle())
  },
})
