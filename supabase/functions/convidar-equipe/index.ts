import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { clienteDoUsuario } from "../_shared/supabase-usuario.ts";
import { consultas } from "./consultas.ts";
import { handle } from "./handler.ts";

Deno.serve((req) =>
  handle(req, {
    env: (n) => Deno.env.get(n),
    db: (a) => consultas(clienteDoUsuario(a)),
    convidar: async ({ email, nome, idioma }) => {
      const admin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      // nome e idioma vão ao metadado: o gatilho criar_perfil usa o nome e o modelo do e-mail usa o idioma.
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { nome, idioma },
      });
      if (error?.code === "email_exists") return "existe";
      if (error || !data.user) {
        throw new Error(`convite falhou (${error?.status ?? "?"})`);
      }
      return { id: data.user.id };
    },
  })
);
