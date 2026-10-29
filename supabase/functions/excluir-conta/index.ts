import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { clienteDoUsuario } from "../_shared/supabase-usuario.ts";
import { consultas } from "./consultas.ts";
import { handle, UsuarioInexistente } from "./handler.ts";

const opcoes = { auth: { persistSession: false, autoRefreshToken: false } };

Deno.serve((req) =>
  handle(req, {
    env: (n) => Deno.env.get(n),
    db: (a) => consultas(clienteDoUsuario(a)),
    // Cliente anônimo separado: não toca na sessão do pedido.
    senhaConfere: async (url, anon, email, password) => {
      const anonimo = createClient(url, anon, opcoes);
      const { error } = await anonimo.auth.signInWithPassword({
        email,
        password,
      });
      if (!error) {
        // Não deixa sessão órfã; falha aqui não muda a resposta.
        await anonimo.auth.signOut().catch(() => {});
        return true;
      }
      if (error.code === "invalid_credentials") return false;
      throw new Error("falha ao conferir a senha");
    },
    apagarUsuario: async (url, serviceRole, uid) => {
      const { error } = await createClient(url, serviceRole, opcoes).auth.admin
        .deleteUser(uid);
      if (error?.code === "user_not_found" || error?.status === 404) {
        throw new UsuarioInexistente();
      }
      if (error) throw new Error("falha ao apagar o usuário");
    },
  })
);
