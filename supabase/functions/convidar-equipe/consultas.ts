import { dados, type Sb, usuarioDoJwt } from "../_shared/supabase-usuario.ts";
import type { Consultas } from "./handler.ts";

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
