// Abre o Portal do Cliente do Stripe (trocar plano, cartão, cancelar). O usuário sai SÓ do JWT.
import { cors, ErroStripe, json, stripePost } from "../_shared/stripe-api.ts";

export type Cliente = { conta_stripe_id: number; stripe_customer_id: string };
export type Consultas = {
  usuario(): Promise<{ id: string } | null>;
  // O mais recente do usuário, filtrado pela conta se ela vier.
  cliente(uid: string, contaId?: number): Promise<Cliente | null>;
};
export type Deps = {
  env: (nome: string) => string | undefined;
  db: (authorization: string) => Consultas;
  fetch?: typeof fetch;
};

export async function handle(req: Request, deps: Deps): Promise<Response> {
  const site = deps.env("SITE_URL");
  if (!site) {
    console.error("stripe-portal: falta a variável SITE_URL");
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
  const { conta_stripe_id, idioma = "pt" } = (corpo ?? {}) as Record<
    string,
    unknown
  >;
  if (
    (conta_stripe_id !== undefined &&
      (!Number.isSafeInteger(conta_stripe_id) ||
        (conta_stripe_id as number) <= 0)) ||
    (idioma !== "pt" && idioma !== "en")
  ) {
    return json({ erro: "entrada_invalida" }, 400, site);
  }

  try {
    const db = deps.db(authorization);
    const usuario = await db.usuario();
    if (!usuario) return json({ erro: "nao_autenticado" }, 401, site);

    // Decisão atual: sem conta_stripe_id (o front não manda), vale o customer mais recente do usuário.
    // Revisar se um membro puder ter assinatura em duas contas.
    const cliente = await db.cliente(
      usuario.id,
      conta_stripe_id as number | undefined,
    );
    if (!cliente) return json({ erro: "sem_cliente" }, 404, site);

    const nomeChave = `STRIPE_SECRET_KEY_${cliente.conta_stripe_id}`;
    const chave = deps.env(nomeChave);
    if (!chave) {
      console.error(`stripe-portal: falta a variável ${nomeChave}`);
      return json({ erro: "configuracao" }, 500, site);
    }

    const sessao = await stripePost(
      "/v1/billing_portal/sessions",
      {
        customer: cliente.stripe_customer_id,
        return_url: `${site.replace(/\/+$/, "")}/${idioma}/perfil`,
      },
      { chave, fetch: deps.fetch },
    );
    if (typeof sessao.url !== "string") {
      throw new ErroStripe("Stripe não devolveu url");
    }
    return json({ url: sessao.url }, 200, site);
  } catch (e) {
    if (e instanceof ErroStripe) {
      console.error(`stripe-portal: ${e.message}`);
      return json({ erro: "stripe" }, 502, site);
    }
    console.error(
      "stripe-portal: erro interno",
      e instanceof Error ? e.message : "",
    );
    return json({ erro: "interno" }, 500, site);
  }
}
