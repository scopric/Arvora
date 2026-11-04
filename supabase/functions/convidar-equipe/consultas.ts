import { dados, type Sb, usuarioDoJwt } from "../_shared/supabase-usuario.ts";
import type { Consultas, Deps } from "./handler.ts";

export const consultas = (sb: Sb): Consultas => ({
  usuario: () => usuarioDoJwt(sb),
  // A própria linha em `equipe` é legível pelo dono (policy equipe_dono_le). Erro lança (500), nunca vira "sem papel".
  papel: async (uid) =>
    dados<{ papel: string } | null>(
      await sb.from("equipe").select("papel").eq("perfil_id", uid)
        .maybeSingle(),
    )?.papel ?? null,
  // Com o JWT de quem convida: as policies de `equipe` (super_admin + aal2) decidem.
  gravarPapel: async (perfil, papel) => {
    dados(
      await sb.from("equipe").upsert({ perfil_id: perfil, papel }, {
        onConflict: "perfil_id",
      }).select("perfil_id").single(),
    );
  },
});

// id de cadastro não confirmado com senha (public.email_cadastro_pendente, só service_role), ou null.
// Erro lança: nunca convida sem saber.
// deno-lint-ignore no-explicit-any
async function pendente(admin: any, email: string): Promise<string | null> {
  const { data, error } = await admin.rpc("email_cadastro_pendente", {
    p_email: email,
  });
  if (error || (data !== null && typeof data !== "string")) {
    throw new Error("checagem do cadastro falhou");
  }
  return data;
}

// Convite pelo Auth com a chave de serviço (cria a conta e manda o e-mail).
// deno-lint-ignore no-explicit-any
export const convidarNoAuth =
  (admin: any): Deps["convidar"] => async ({ email, nome, idioma }) => {
    // Cadastro com senha e sem confirmar: a conta nunca entrou (confirmação obrigatória) e a senha pode ser de
    // quem usou o e-mail alheio. Apaga e convida do zero; confirmar esse cadastro entregaria a conta a essa pessoa.
    const antigo = await pendente(admin, email);
    if (antigo) {
      const { error: e } = await admin.auth.admin.deleteUser(antigo);
      if (e) {
        throw new Error(`cadastro pendente não apagado (${e.status ?? "?"})`);
      }
    }
    // nome e idioma vão ao metadado: o gatilho criar_perfil usa o nome e o modelo do e-mail usa o idioma.
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { nome, idioma },
    });
    if (error?.code === "email_exists") return "existe";
    if (error?.code === "over_email_send_rate_limit") return "limite";
    if (error || !data.user) {
      throw new Error(`convite falhou (${error?.status ?? "?"})`);
    }
    // De novo depois do convite: fecha a janela de um cadastro com senha feito entre a 1ª checagem e o convite
    // (cadastro depois do convite não grava senha).
    if (await pendente(admin, email)) return "pendente";
    return { id: data.user.id };
  };
