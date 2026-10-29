// Chamada à API REST do Stripe (form-urlencoded), sem SDK. Usado por stripe-checkout e stripe-portal.

export type Params = {
  [k: string]: string | number | boolean | Params | Params[] | undefined;
};

// { a: [{ b: 1 }] } -> "a[0][b]=1" (formato de chaves aninhadas do Stripe).
export function codificarForm(params: Params): string {
  const pares: [string, string][] = [];
  const andar = (valor: unknown, chave: string) => {
    if (valor === undefined) return;
    if (typeof valor === "object" && valor !== null) {
      for (const [k, v] of Object.entries(valor)) {
        andar(v, chave ? `${chave}[${k}]` : k);
      }
    } else pares.push([chave, String(valor)]);
  };
  andar(params, "");
  return new URLSearchParams(pares).toString();
}

export class ErroStripe extends Error {}

export async function stripePost(
  path: string,
  params: Params,
  { chave, idempotencyKey, fetch: f = fetch }: {
    chave: string;
    idempotencyKey?: string;
    fetch?: typeof fetch;
  },
): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${chave}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const r = await f(`https://api.stripe.com${path}`, {
    method: "POST",
    headers,
    body: codificarForm(params),
  });
  // Só o status vai ao log: o corpo do Stripe pode ter dado pessoal.
  if (!r.ok) {
    await r.body?.cancel();
    throw new ErroStripe(`Stripe ${path} respondeu ${r.status}`);
  }
  return await r.json();
}

// Comum às duas funções: CORS restrito a SITE_URL e respostas JSON.
export function cors(siteUrl: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": new URL(siteUrl).origin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

export function json(
  corpo: unknown,
  status: number,
  siteUrl?: string,
  extra: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...(siteUrl ? cors(siteUrl) : {}),
      ...extra,
    },
  });
}

export async function hash(texto: string): Promise<string> {
  const d = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(texto),
  );
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0"))
    .join("");
}
