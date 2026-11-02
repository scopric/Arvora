import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { clienteDoUsuario } from "../_shared/supabase-usuario.ts";
import { consultas } from "./consultas.ts";
import { handle, UsuarioInexistente } from "./handler.ts";

const opcoes = { auth: { persistSession: false, autoRefreshToken: false } };

Deno.serve((req) =>
  handle(req, {
    env: (n) => Deno.env.get(n),
    db: (a) => consultas(clienteDoUsuario(a)),
    // Cliente separado: não toca na sessão do pedido. Com a chave de serviço o CAPTCHA do Auth não se aplica.
    senhaConfere: async (url, serviceRole, email, password) => {
      const anonimo = createClient(url, serviceRole, opcoes);
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
      const admin = createClient(url, serviceRole, opcoes);
      // Arquivos do titular (entregas) saem do Storage ANTES: o cascade só apaga linhas, e o banco recusa
      // apagar o perfil se ainda houver arquivo (f4_02).
      const { data: arquivos, error: erroLista } = await admin.rpc(
        "arquivos_do_titular",
        { p_uid: uid },
      );
      if (erroLista) throw new Error("falha ao listar os arquivos");
      const porBucket = new Map<string, string[]>();
      for (const a of (arquivos ?? []) as { bucket: string; nome: string }[]) {
        porBucket.set(a.bucket, [...(porBucket.get(a.bucket) ?? []), a.nome]);
      }
      for (const [bucket, nomes] of porBucket) {
        for (let i = 0; i < nomes.length; i += 100) {
          const { error: erroRemove } = await admin.storage.from(bucket)
            .remove(nomes.slice(i, i + 100));
          if (erroRemove) throw new Error("falha ao apagar os arquivos");
        }
      }
      const { error } = await admin.auth.admin.deleteUser(uid);
      if (error?.code === "user_not_found" || error?.status === 404) {
        throw new UsuarioInexistente();
      }
      if (error) throw new Error("falha ao apagar o usuário");
    },
  })
);
