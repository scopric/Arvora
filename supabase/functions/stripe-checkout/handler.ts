// Cria a Checkout Session do Stripe para um plano. Preço e conta saem da tabela planos (servidor),
// o usuário sai SÓ do JWT. Não grava nada: a assinatura passa a valer quando o webhook processar o pagamento.
import {
  cors,
  ErroStripe,
  hash,
  json,
  stripePost,
} from "../_shared/stripe-api.ts";

export type Plano = {
  conta_stripe_id: number;
  stripe_price_id: string;
  intervalo: string;
};
export type Consultas = {
  consumirLimite(acao: string): Promise<boolean>;
  usuario(): Promise<{ id: string; email?: string } | null>;
  plano(id: number): Promise<Plano | null>; // só ativo
  customer(uid: string, contaId: number): Promise<string | null>;
  temAssinaturaVigente(uid: string): Promise<boolean>; // em qualquer conta
};
// Limite real (max e janela) é do banco: public.consumir_limite. A janela aqui serve só ao Retry-After;
// mantenha igual ao limite em consumir_limite no banco.
const LIMITE = { acao: "checkout", janelaSeg: 600 };

export type Deps = {
  env: (nome: string) => string | undefined;
  db: (authorization: string) => Consultas;
  fetch?: typeof fetch;
  agora?: () => number;
};

export async function handle(req: Request, deps: Deps): Promise<Response> {
  const site = deps.env("SITE_URL");
  if (!site) {
    console.error("stripe-checkout: falta a variável SITE_URL");
    return json({ erro: "configuracao" }, 500);
  }
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(site) });
  }
  if (req.method !== "POST") return json({ erro: "metodo" }, 405, site);
  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ erro: "nao_autenticado" }, 401, site);

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return json({ erro: "json_invalido" }, 400, site);
  }
  // Só plano_id e idioma são lidos; qualquer outro campo (perfil, client_reference_id...) é ignorado.
  const { plano_id, idioma = "pt" } = (corpo ?? {}) as Record<string, unknown>;
  if (
    !Number.isSafeInteger(plano_id) || (plano_id as number) <= 0 ||
    (idioma !== "pt" && idioma !== "en")
  ) {
    return json({ erro: "entrada_invalida" }, 400, site);
  }

  try {
    const db = deps.db(authorization);
    const usuario = await db.usuario();
    if (!usuario) return json({ erro: "nao_autenticado" }, 401, site);

    // Antes de qualquer consulta cara ou chamada ao Stripe. Erro do RPC lança (500): nunca libera.
    if (!(await db.consumirLimite(LIMITE.acao))) {
      return json({ erro: "limite" }, 429, site, {
        "Retry-After": String(LIMITE.janelaSeg),
      });
    }

    const plano = await db.plano(plano_id as number);
    if (!plano) return json({ erro: "plano_nao_encontrado" }, 404, site);

    const nomeChave = `STRIPE_SECRET_KEY_${plano.conta_stripe_id}`;
    const chave = deps.env(nomeChave);
    if (!chave) {
      console.error(`stripe-checkout: falta a variável ${nomeChave}`);
      return json({ erro: "configuracao" }, 500, site);
    }

    // Regra provisória: UMA assinatura vigente por perfil, em qualquer conta. Clube -> Grupo é troca
    // de plano pelo portal (mesma assinatura), não um novo checkout. Plano único (avulso) é isento.
    const assinatura = plano.intervalo !== "unico";
    if (assinatura && (await db.temAssinaturaVigente(usuario.id))) {
      return json({ erro: "assinatura_existente" }, 409, site);
    }

    const customer = await db.customer(usuario.id, plano.conta_stripe_id);
    const base = site.replace(/\/+$/, "");
    const minuto = Math.floor((deps.agora ?? Date.now)() / 60_000);
    const sessao = await stripePost(
      "/v1/checkout/sessions",
      {
        mode: assinatura ? "subscription" : "payment",
        line_items: [{ price: plano.stripe_price_id, quantity: 1 }],
        client_reference_id: usuario.id,
        // Sem customer: em mode=payment o Stripe não cria Customer por padrão, e o webhook exige um.
        ...(customer ? { customer } : {
          customer_email: usuario.email,
          customer_creation: assinatura ? undefined : "always",
        }),
        success_url: `${base}/${idioma}/perfil?checkout=ok`,
        cancel_url: `${base}/${idioma}/perfil?checkout=cancelado`,
        locale: idioma === "pt" ? "pt-BR" : "en",
      },
      {
        chave,
        idempotencyKey: await hash(
          `checkout:${usuario.id}:${plano_id}:${idioma}:${
            customer ?? "novo"
          }:${minuto}`,
        ),
        fetch: deps.fetch,
      },
    );
    if (typeof sessao.url !== "string") {
      throw new ErroStripe("Stripe não devolveu url");
    }
    return json({ url: sessao.url }, 200, site);
  } catch (e) {
    if (e instanceof ErroStripe) {
      console.error(`stripe-checkout: ${e.message}`);
      return json({ erro: "stripe" }, 502, site);
    }
    console.error(
      "stripe-checkout: erro interno",
      e instanceof Error ? e.message : "",
    );
    return json({ erro: "interno" }, 500, site);
  }
}
