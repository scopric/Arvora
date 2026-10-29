// Ponto de entrada da Edge Function. O servidor é ligado SEMPRE, no topo do módulo: o runtime de
// funções do Supabase carrega este arquivo como entrypoint e não se deve depender de import.meta.main.
// A lógica (verificação da assinatura, tradução para HTTP) fica em handler.ts, que os testes importam.
import { createClient } from "@supabase/supabase-js";
import { handle } from "./handler.ts";

const url = Deno.env.get("SUPABASE_URL");
const chaveServico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !chaveServico) {
  throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias");
}

const supabase = createClient(url, chaveServico, {
  auth: { persistSession: false },
});

Deno.serve((req) =>
  handle(req, {
    segredoDaConta: (id) => Deno.env.get("STRIPE_WEBHOOK_SECRET_" + id),
    processar: async (contaId, evento) => {
      const { data, error } = await supabase.rpc("processar_evento_stripe", {
        p_conta_stripe_id: contaId,
        p_evento: evento,
      });
      if (error) throw new Error(error.code ?? error.message);
      return String(data);
    },
  })
);
