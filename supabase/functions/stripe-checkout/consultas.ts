import {
  consumirLimiteDb,
  dados,
  type Sb,
  usuarioDoJwt,
} from "../_shared/supabase-usuario.ts";
import { type Consultas, MaioridadePendente } from "./handler.ts";

export const consultas = (sb: Sb): Consultas => ({
  usuario: () => usuarioDoJwt(sb),
  consumirLimite: (acao) => consumirLimiteDb(sb, acao),
  // ativo explícito: as políticas de assinante e super_admin também deixam ler planos inativos.
  plano: async (id) =>
    dados(
      await sb.from("planos").select(
        "conta_stripe_id, stripe_price_id, intervalo",
      ).eq("id", id).eq("ativo", true).maybeSingle(),
    ),
  // perfil_id explícito em clientes_stripe e assinaturas: não depender só do RLS
  // (a política do financeiro deixa super_admin e auditor verem as assinaturas de todos).
  customer: async (uid, conta) =>
    dados<{ stripe_customer_id: string } | null>(
      await sb.from("clientes_stripe").select("stripe_customer_id").eq(
        "perfil_id",
        uid,
      ).eq("conta_stripe_id", conta)
        .order("criado_em", { ascending: false }).limit(1).maybeSingle(),
    )?.stripe_customer_id ?? null,
  registrarAceite: async (planoId, versao) => {
    const { error } = await sb.rpc("registrar_aceite_checkout", {
      p_plano_id: planoId,
      p_versao: versao,
    });
    if (
      String((error as { message?: unknown } | null)?.message).includes(
        "maior_18_pendente",
      )
    ) {
      throw new MaioridadePendente();
    }
    if (error) throw new Error("aceite falhou");
  },
  temAssinaturaVigente: async (uid) =>
    (dados<{ id: number }[] | null>(
      await sb.from("assinaturas").select("id").eq("perfil_id", uid)
        .in("status", ["active", "trialing", "past_due"]).limit(1),
    ) ?? []).length > 0,
});
