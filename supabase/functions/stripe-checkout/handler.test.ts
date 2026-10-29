import { deepEqual, equal, ok } from "node:assert/strict";
import { type Consultas, type Deps, handle, type Plano } from "./handler.ts";

const SITE = "https://site.exemplo";
const CHAVE = "chave_falsa_conta_1";
const UID = "00000000-0000-0000-0000-0000000000aa";

function montar(o: {
  planos?: Record<number, Plano>;
  customer?: string | null;
  vigente?: boolean;
  limite?: boolean | "erro";
  env?: Record<string, string>;
  stripe?: () => Response;
} = {}) {
  const chamadas: { url: string; init: RequestInit; corpo: URLSearchParams }[] =
    [];
  const planos = o.planos ??
    {
      7: {
        conta_stripe_id: 1,
        stripe_price_id: "price_teste_7",
        intervalo: "mes",
      },
    };
  const limites: string[] = [];
  const consultas: string[] = [];
  const db: Consultas = {
    consumirLimite: (a) => {
      limites.push(a);
      return o.limite === "erro"
        ? Promise.reject(new Error("rpc"))
        : Promise.resolve(o.limite ?? true);
    },
    usuario: () => Promise.resolve({ id: UID, email: "jwt@exemplo.invalid" }),
    plano: (
      id,
    ) => (consultas.push("plano"), Promise.resolve(planos[id] ?? null)),
    customer: () => Promise.resolve(o.customer ?? null),
    temAssinaturaVigente: () => Promise.resolve(o.vigente ?? false),
  };
  const deps: Deps = {
    env: (n) => (o.env ?? { SITE_URL: SITE, STRIPE_SECRET_KEY_1: CHAVE })[n],
    db: () => db,
    agora: () => 0,
    fetch: (url, init) => {
      chamadas.push({
        url: String(url),
        init: init!,
        corpo: new URLSearchParams(String(init!.body)),
      });
      return Promise.resolve(
        o.stripe?.() ??
          Response.json({
            id: "cs_teste",
            url: "https://checkout.stripe.com/c/teste",
          }),
      );
    },
  };
  return { deps, chamadas, limites, consultas };
}

const post = (corpo: unknown, headers: Record<string, string> = {}) =>
  new Request("https://fn.exemplo/stripe-checkout", {
    method: "POST",
    headers: {
      Authorization: "Bearer jwt_falso",
      Origin: "https://malicioso.exemplo",
      Host: "malicioso.exemplo",
      ...headers,
    },
    body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
  });

Deno.test("checkout feliz: corpo enviado ao Stripe sai do servidor e do JWT", async () => {
  const { deps, chamadas } = montar();
  const r = await handle(post({ plano_id: 7 }), deps);
  equal(r.status, 200);
  deepEqual(await r.json(), { url: "https://checkout.stripe.com/c/teste" });
  equal(r.headers.get("Access-Control-Allow-Origin"), SITE);
  equal(chamadas.length, 1);
  const { url, init, corpo } = chamadas[0];
  equal(url, "https://api.stripe.com/v1/checkout/sessions");
  const h = init.headers as Record<string, string>;
  equal(h.Authorization, `Bearer ${CHAVE}`);
  equal(h["Content-Type"], "application/x-www-form-urlencoded");
  ok(/^[0-9a-f]{64}$/.test(h["Idempotency-Key"]));
  equal(corpo.get("mode"), "subscription");
  equal(corpo.get("line_items[0][price]"), "price_teste_7");
  equal(corpo.get("line_items[0][quantity]"), "1");
  equal(corpo.get("client_reference_id"), UID);
  equal(corpo.get("customer_email"), "jwt@exemplo.invalid");
  equal(corpo.get("customer"), null);
  equal(corpo.get("success_url"), `${SITE}/pt/perfil?checkout=ok`);
  equal(corpo.get("cancel_url"), `${SITE}/pt/perfil?checkout=cancelado`);
  equal(corpo.get("locale"), "pt-BR");
});

Deno.test("checkout: customer existente, idioma en, plano único vira mode=payment", async () => {
  const { deps, chamadas } = montar({
    planos: {
      3: {
        conta_stripe_id: 1,
        stripe_price_id: "price_teste_3",
        intervalo: "unico",
      },
    },
    customer: "cus_teste",
    vigente: true, // compra avulsa não é bloqueada por assinatura vigente
  });
  const r = await handle(post({ plano_id: 3, idioma: "en" }), deps);
  equal(r.status, 200);
  const c = chamadas[0].corpo;
  equal(c.get("mode"), "payment");
  equal(c.get("customer"), "cus_teste");
  equal(c.get("customer_email"), null);
  equal(c.get("locale"), "en");
  equal(c.get("success_url"), `${SITE}/en/perfil?checkout=ok`);
});

Deno.test("checkout: plano anual é subscription", async () => {
  const { deps, chamadas } = montar({
    planos: {
      7: { conta_stripe_id: 1, stripe_price_id: "p", intervalo: "ano" },
    },
  });
  equal((await handle(post({ plano_id: 7 }), deps)).status, 200);
  equal(chamadas[0].corpo.get("mode"), "subscription");
});

Deno.test("checkout: idempotency key estável no mesmo minuto, muda com o plano", async () => {
  const a = montar();
  await handle(post({ plano_id: 7 }), a.deps);
  await handle(post({ plano_id: 7 }), a.deps);
  const k = (i: number) =>
    (a.chamadas[i].init.headers as Record<string, string>)["Idempotency-Key"];
  equal(k(0), k(1));
  const c = montar({
    planos: {
      8: { conta_stripe_id: 1, stripe_price_id: "p8", intervalo: "mes" },
    },
  });
  await handle(post({ plano_id: 8 }), c.deps);
  ok(
    (c.chamadas[0].init.headers as Record<string, string>)[
      "Idempotency-Key"
    ] !== k(0),
  );
});

Deno.test("checkout: corpo tentando impor usuário, preço ou urls é ignorado", async () => {
  const { deps, chamadas } = montar();
  const r = await handle(
    post({
      plano_id: 7,
      client_reference_id: "11111111-1111-1111-1111-111111111111",
      perfil_id: "11111111-1111-1111-1111-111111111111",
      email: "outro@exemplo.invalid",
      price: "price_barato",
      success_url: "https://malicioso.exemplo/ok",
    }),
    deps,
  );
  equal(r.status, 200);
  const c = chamadas[0].corpo;
  equal(c.get("client_reference_id"), UID);
  equal(c.get("customer_email"), "jwt@exemplo.invalid");
  equal(c.get("line_items[0][price]"), "price_teste_7");
  ok(!c.toString().includes("malicioso"));
  ok(!c.toString().includes("1111"));
});

Deno.test("checkout: plano inexistente ou inativo é 404 sem chamar o Stripe", async () => {
  const { deps, chamadas } = montar();
  const r = await handle(post({ plano_id: 99 }), deps);
  equal(r.status, 404);
  equal(chamadas.length, 0);
});

Deno.test("checkout: já assinante (em qualquer conta) é 409", async () => {
  const { deps, chamadas } = montar({ vigente: true });
  const r = await handle(post({ plano_id: 7 }), deps);
  equal(r.status, 409);
  deepEqual(await r.json(), { erro: "assinatura_existente" });
  equal(chamadas.length, 0);
});

Deno.test("checkout: sem a chave da conta é 500, sem chave reserva", async () => {
  const { deps, chamadas } = montar({
    env: { SITE_URL: SITE, STRIPE_SECRET_KEY_2: "chave_falsa_conta_2" },
  });
  const r = await handle(post({ plano_id: 7 }), deps);
  equal(r.status, 500);
  const t = await r.text();
  ok(!t.includes("chave_falsa"));
  equal(chamadas.length, 0);
});

Deno.test("checkout: falha do Stripe vira 502 sem vazar o corpo nem a chave", async () => {
  const { deps } = montar({
    stripe: () =>
      Response.json(
        { error: { message: "dado pessoal jwt@exemplo.invalid" } },
        { status: 400 },
      ),
  });
  const r = await handle(post({ plano_id: 7 }), deps);
  equal(r.status, 502);
  const t = await r.text();
  deepEqual(JSON.parse(t), { erro: "stripe" });
  ok(!t.includes(CHAVE));
});

Deno.test("checkout: sem SITE_URL é 500", async () => {
  const { deps } = montar({ env: { STRIPE_SECRET_KEY_1: CHAVE } });
  equal((await handle(post({ plano_id: 7 }), deps)).status, 500);
});

Deno.test("checkout: entrada inválida", async () => {
  const { deps, chamadas } = montar();
  equal(
    (await handle(new Request("https://fn.exemplo/x", { method: "GET" }), deps))
      .status,
    405,
  );
  equal((await handle(post("{nao json"), deps)).status, 400);
  for (
    const corpo of [
      {},
      { plano_id: "7" },
      { plano_id: 1.5 },
      { plano_id: 0 },
      { plano_id: -3 },
      { plano_id: 7, idioma: "es" },
      null,
    ]
  ) {
    equal((await handle(post(corpo), deps)).status, 400, JSON.stringify(corpo));
  }
  const semAuth = new Request("https://fn.exemplo/x", {
    method: "POST",
    body: JSON.stringify({ plano_id: 7 }),
  });
  equal((await handle(semAuth, deps)).status, 401);
  equal(chamadas.length, 0);
});

Deno.test("checkout: JWT sem usuário válido é 401", async () => {
  const { deps } = montar();
  const d: Deps = {
    ...deps,
    db: (a) => ({ ...deps.db(a), usuario: () => Promise.resolve(null) }),
  };
  equal((await handle(post({ plano_id: 7 }), d)).status, 401);
});

Deno.test("checkout: preflight com CORS só para SITE_URL, ignorando Origin", async () => {
  const { deps } = montar();
  const r = await handle(
    new Request("https://fn.exemplo/x", {
      method: "OPTIONS",
      headers: { Origin: "https://malicioso.exemplo" },
    }),
    deps,
  );
  equal(r.status, 204);
  equal(r.headers.get("Access-Control-Allow-Origin"), SITE);
  ok(!r.headers.get("Access-Control-Allow-Methods")!.includes("GET"));
});

Deno.test("checkout: customer_creation=always só em pagamento único sem customer", async () => {
  const caso = async (intervalo: string, customer: string | null) => {
    const { deps, chamadas } = montar({
      planos: { 7: { conta_stripe_id: 1, stripe_price_id: "p", intervalo } },
      customer,
    });
    equal((await handle(post({ plano_id: 7 }), deps)).status, 200);
    return chamadas[0].corpo;
  };
  const semCustomer = await caso("unico", null);
  equal(semCustomer.get("customer_creation"), "always");
  equal(semCustomer.get("customer"), null);
  const comCustomer = await caso("unico", "cus_teste");
  equal(comCustomer.get("customer_creation"), null);
  equal(comCustomer.get("customer"), "cus_teste");
  equal((await caso("mes", null)).get("customer_creation"), null);
  equal((await caso("ano", null)).get("customer_creation"), null);
});

Deno.test("checkout: sem e-mail confirmado, customer_email é omitido", async () => {
  const { deps, chamadas } = montar();
  const d: Deps = {
    ...deps,
    db: (a) => ({ ...deps.db(a), usuario: () => Promise.resolve({ id: UID }) }),
  };
  equal((await handle(post({ plano_id: 7 }), d)).status, 200);
  ok(!chamadas[0].corpo.has("customer_email"));
  equal(chamadas[0].corpo.get("client_reference_id"), UID);
});

Deno.test("checkout: idempotency key muda quando o customer muda", async () => {
  const a = montar({ customer: null }), b = montar({ customer: "cus_teste" });
  await handle(post({ plano_id: 7 }), a.deps);
  await handle(post({ plano_id: 7 }), b.deps);
  const k = (m: typeof a) =>
    (m.chamadas[0].init.headers as Record<string, string>)["Idempotency-Key"];
  ok(k(a) !== k(b));
});

Deno.test("checkout: dentro do limite segue, com a chave da ação checkout", async () => {
  const { deps, limites } = montar();
  equal((await handle(post({ plano_id: 7 }), deps)).status, 200);
  deepEqual(limites, ["checkout"]);
});

Deno.test("checkout: excedeu o limite é 429 com Retry-After e nada é chamado", async () => {
  const { deps, chamadas, consultas } = montar({ limite: false });
  const r = await handle(post({ plano_id: 7 }), deps);
  equal(r.status, 429);
  deepEqual(await r.json(), { erro: "limite" });
  equal(r.headers.get("Retry-After"), "600");
  equal(chamadas.length, 0);
  equal(consultas.length, 0);
});

Deno.test("checkout: erro do RPC é 500 e nada é chamado, nunca libera", async () => {
  const { deps, chamadas, consultas } = montar({ limite: "erro" });
  const r = await handle(post({ plano_id: 7 }), deps);
  equal(r.status, 500);
  equal(chamadas.length, 0);
  equal(consultas.length, 0);
});
