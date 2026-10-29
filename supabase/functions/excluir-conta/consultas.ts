import { dados, type Sb } from "../_shared/supabase-usuario.ts";
import type { Assinatura, Consultas } from "./handler.ts";

// perfil_id explícito: não depender só do RLS (a política do financeiro deixa super_admin e auditor
// verem as assinaturas de todos). Erro de consulta lança (500), nunca vira "vazio".
export const consultas = (sb: Sb): Consultas => ({
  // E-mail cru (mesmo sem confirmação): a senha conferida depois já prova que é o dono.
  usuario: async () => {
    const { data, error } = await sb.auth.getUser();
    const u = data?.user;
    if (error || !u) return null;
    return {
      id: u.id,
      email: u.email,
      totp: (u.factors ?? []).some((
        f: { factor_type?: string; status?: string },
      ) => f.factor_type === "totp" && f.status === "verified"),
    };
  },
  temEquipe: async (uid) =>
    (dados<{ perfil_id: string }[] | null>(
      await sb.from("equipe").select("perfil_id").eq("perfil_id", uid)
        .limit(1),
    ) ?? []).length > 0,
  assinaturasVigentes: async (uid) =>
    (dados<Assinatura[] | null>(
      await sb.from("assinaturas").select(
        "stripe_subscription_id, conta_stripe_id",
      ).eq("perfil_id", uid)
        .in("status", ["active", "trialing", "past_due"]),
    ) ?? []).filter((a) => a.stripe_subscription_id !== null),
});
