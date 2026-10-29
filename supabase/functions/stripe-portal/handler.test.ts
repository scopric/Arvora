import { deepEqual, equal, ok } from "node:assert/strict";
import { type Cliente, type Deps, handle } from "./handler.ts";

const SITE = "https://site.exemplo";
const UID = "00000000-0000-0000-0000-0000000000aa";
// Mais recente primeiro, como a consulta real (order criado_em desc).
const CLIENTES: (Cliente & { perfil: string })[] = [
  { perfil: UID, conta_stripe_id: 2, stripe_customer_id: "cus_conta2" },
  { perfil: UID, conta_stripe_id: 1, stripe_customer_id: "cus_conta1" },
  { perfil: "outro", conta_stripe_id: 3, stripe_customer_id: "cus_outro" },
];

function montar(
  o: {
    clientes?: typeof CLIENTES;
    env?: Record<string, string>;
    stripe?: () => Response;
    limite?: boolean | "erro";
  } = {},
) {
  const chamadas: { url: string; init: RequestInit; corpo: URLSearchParams }[] =
    [];
  const limites: string[] = [];
  const consultas: string[] = [];
  const deps: Deps = {
    env: (n) =>
      (o.env ??
        {
          SITE_URL: SITE,
          STRIPE_SECRET_KEY_1: "chave_falsa_conta_1",
          STRIPE_SECRET_KEY_2: "chave_falsa_conta_2",
        })[n],
    db: () => ({
      consumirLimite: (a) => {
        limites.push(a);
        return o.limite === "erro"
          ? Promise.reject(new Error("rpc"))
          : Promise.resolve(o.limite ?? true);
      },
      usuario: () => Promise.resolve({ id: UID }),
      cliente: (uid, conta) => (
        consultas.push("cliente"),
          Promise.resolve(
            (o.clientes ?? CLIENTES).find((c) =>
              c.perfil === uid &&
              (conta === undefined || c.conta_stripe_id === conta)
            ) ?? null,
          )
      ),
    }),
    fetch: (url, init) => {
      chamadas.push({
        url: String(url),
        init: init!,
        corpo: new URLSearchParams(String(init!.body)),
      });
      return Promise.resolve(
        o.stripe?.() ??
          Response.json({ url: "https://billing.stripe.com/p/teste" }),
      );
    },
  };
  return { deps, chamadas, limites, consultas };
}

const post = (corpo: unknown) =>
  new Request("https://fn.exemplo/stripe-portal", {
    method: "POST",
    headers: {
      Authorization: "Bearer jwt_falso",
      Origin: "https://malicioso.exemplo",
    },
    body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
  });

Deno.test("portal feliz: conta mais recente quando nenhuma é escolhida", async () => {
  const { deps, chamadas } = montar();
  const r = await handle(post({}), deps);
  equal(r.status, 200);
  deepEqual(await r.json(), { url: "https://billing.stripe.com/p/teste" });
  equal(r.headers.get("Access-Control-Allow-Origin"), SITE);
  equal(chamadas[0].url, "https://api.stripe.com/v1/billing_portal/sessions");
  equal(
    (chamadas[0].init.headers as Record<string, string>).Authorization,
    "Bearer chave_falsa_conta_2",
  );
  equal(chamadas[0].corpo.get("customer"), "cus_conta2");
  equal(chamadas[0].corpo.get("return_url"), `${SITE}/pt/perfil`);
});

Deno.test("portal: escolha de conta e idioma", async () => {
  const { deps, chamadas } = montar();
  equal(
    (await handle(post({ conta_stripe_id: 1, idioma: "en" }), deps)).status,
    200,
  );
  equal(chamadas[0].corpo.get("customer"), "cus_conta1");
  equal(
    (chamadas[0].init.headers as Record<string, string>).Authorization,
    "Bearer chave_falsa_conta_1",
  );
  equal(chamadas[0].corpo.get("return_url"), `${SITE}/en/perfil`);
});

Deno.test("portal: sem cliente é 404, inclusive conta de outra pessoa", async () => {
  const { deps, chamadas } = montar();
  const r = await handle(post({ conta_stripe_id: 3 }), deps);
  equal(r.status, 404);
  deepEqual(await r.json(), { erro: "sem_cliente" });
  equal((await handle(post({}), montar({ clientes: [] }).deps)).status, 404);
  equal(chamadas.length, 0);
});

Deno.test("portal: sem chave da conta é 500; Stripe falhando é 502 sem vazar", async () => {
  const sem = await handle(post({}), montar({ env: { SITE_URL: SITE } }).deps);
  equal(sem.status, 500);
  ok(!(await sem.text()).includes("chave_falsa"));
  const r = await handle(
    post({}),
    montar({
      stripe: () => new Response("cus_conta2 segredo", { status: 500 }),
    }).deps,
  );
  equal(r.status, 502);
  deepEqual(await r.json(), { erro: "stripe" });
});

Deno.test("portal: entrada inválida e CORS", async () => {
  const { deps } = montar();
  equal(
    (await handle(new Request("https://fn.exemplo/x", { method: "PUT" }), deps))
      .status,
    405,
  );
  equal((await handle(post("x{"), deps)).status, 400);
  equal((await handle(post({ conta_stripe_id: "1" }), deps)).status, 400);
  equal(
    (await handle(
      new Request("https://fn.exemplo/x", { method: "POST", body: "{}" }),
      deps,
    )).status,
    401,
  );
  const pre = await handle(
    new Request("https://fn.exemplo/x", { method: "OPTIONS" }),
    deps,
  );
  equal(pre.status, 204);
  equal(pre.headers.get("Access-Control-Allow-Origin"), SITE);
});

Deno.test("portal: dentro do limite segue, com a chave da ação portal", async () => {
  const { deps, limites } = montar();
  equal((await handle(post({}), deps)).status, 200);
  deepEqual(limites, ["portal"]);
});

Deno.test("portal: excedeu o limite é 429 com Retry-After e nada é chamado", async () => {
  const { deps, chamadas, consultas } = montar({ limite: false });
  const r = await handle(post({}), deps);
  equal(r.status, 429);
  deepEqual(await r.json(), { erro: "limite" });
  equal(r.headers.get("Retry-After"), "600");
  equal(chamadas.length, 0);
  equal(consultas.length, 0);
});

Deno.test("portal: erro do RPC é 500 e nada é chamado, nunca libera", async () => {
  const { deps, chamadas, consultas } = montar({ limite: "erro" });
  const r = await handle(post({}), deps);
  equal(r.status, 500);
  equal(chamadas.length, 0);
  equal(consultas.length, 0);
});
