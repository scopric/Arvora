import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { clienteDoUsuario } from "../_shared/supabase-usuario.ts";
import { consultas, convidarNoAuth } from "./consultas.ts";
import { handle } from "./handler.ts";

Deno.serve((req) =>
  handle(req, {
    env: (n) => Deno.env.get(n),
    db: (a) => consultas(clienteDoUsuario(a)),
    convidar: convidarNoAuth(
      createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false, autoRefreshToken: false } },
      ),
    ),
  })
);
