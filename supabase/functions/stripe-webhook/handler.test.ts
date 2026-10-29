import { assert, assertEquals } from "jsr:@std/assert@1.0.19";
import Stripe from "stripe";
import { handle } from "./handler.ts";
import evento from "./fixtures/customer.subscription.updated.json" with {
  type: "json",
};

const SEGREDO = "whsec_FALSO_so_para_teste"; // falso, só no teste
const corpo = JSON.stringify(evento);

function deps(
  processar: (c: number, e: unknown) => Promise<string> = () =>
    Promise.resolve("processado"),
) {
  const chamadas: [number, unknown][] = [];
  return {
    chamadas,
    segredoDaConta: (id: string) => (id === "7" ? SEGREDO : undefined),
    processar: (c: number, e: unknown) => {
      chamadas.push([c, e]);
      return processar(c, e);
    },
  };
}

async function req(
  opts: {
    conta?: string;
    body?: string;
    header?: string | null;
    method?: string;
  } = {},
) {
  const body = opts.body ?? corpo;
  const header = opts.header === undefined
    ? await Stripe.webhooks.generateTestHeaderStringAsync({
      payload: body,
      secret: SEGREDO,
    })
    : opts.header;
  const headers = new Headers();
  if (header) headers.set("stripe-signature", header);
  return new Request(`http://x/stripe-webhook/${opts.conta ?? "7"}`, {
    method: opts.method ?? "POST",
    headers,
    body: (opts.method ?? "POST") === "GET" ? undefined : body,
  });
}

Deno.test("válido → 200 e processar 1 vez com conta e evento", async () => {
  const d = deps();
  const r = await handle(await req(), d);
  assertEquals(r.status, 200);
  assertEquals(await r.text(), "processado");
  assertEquals(d.chamadas.length, 1);
  assertEquals(d.chamadas[0][0], 7);
  assertEquals(d.chamadas[0][1], evento);
});

Deno.test("header ausente → 400 sem processar", async () => {
  const d = deps();
  const r = await handle(await req({ header: null }), d);
  assertEquals(r.status, 400);
  assertEquals(await r.text(), "");
  assertEquals(d.chamadas.length, 0);
});

Deno.test("segredo errado → 400", async () => {
  const header = await Stripe.webhooks.generateTestHeaderStringAsync({
    payload: corpo,
    secret: "whsec_outro_falso",
  });
  const d = deps();
  assertEquals((await handle(await req({ header }), d)).status, 400);
  assertEquals(d.chamadas.length, 0);
});

Deno.test("corpo adulterado → 400", async () => {
  const header = await Stripe.webhooks.generateTestHeaderStringAsync({
    payload: corpo,
    secret: SEGREDO,
  });
  const d = deps();
  const r = await handle(
    await req({ header, body: corpo.replace("active", "canceled") }),
    d,
  );
  assertEquals(r.status, 400);
  assertEquals(d.chamadas.length, 0);
});

Deno.test("timestamp vencido → 400", async () => {
  const header = await Stripe.webhooks.generateTestHeaderStringAsync({
    payload: corpo,
    secret: SEGREDO,
    timestamp: Math.floor(Date.now() / 1000) - 301,
  });
  const d = deps();
  assertEquals((await handle(await req({ header }), d)).status, 400);
  assertEquals(d.chamadas.length, 0);
});

Deno.test("conta sem segredo → 400", async () => {
  const d = deps();
  assertEquals((await handle(await req({ conta: "8" }), d)).status, 400);
  assertEquals(d.chamadas.length, 0);
});

for (const conta of ["abc", "0", "-1", "1.5"]) {
  Deno.test(`conta inválida "${conta}" → 400`, async () => {
    const d = deps();
    assertEquals((await handle(await req({ conta }), d)).status, 400);
    assertEquals(d.chamadas.length, 0);
  });
}

Deno.test("GET → 405", async () => {
  const d = deps();
  assertEquals((await handle(await req({ method: "GET" }), d)).status, 405);
  assertEquals(d.chamadas.length, 0);
});

Deno.test("processar lança → 500 sem corpo nem e-mail na resposta", async () => {
  const d = deps(() => Promise.reject(new Error("cliente_desconhecido")));
  const r = await handle(await req(), d);
  assertEquals(r.status, 500);
  const texto = await r.text();
  assert(!texto.includes("membro.ficticio@exemplo.invalid"));
  assert(!texto.includes("evt_teste_0001"));
  assert(!texto.includes(corpo));
});

for (const resultado of ["duplicado", "ignorado_orfao"]) {
  Deno.test(`processar devolve ${resultado} → 200`, async () => {
    const r = await handle(await req(), deps(() => Promise.resolve(resultado)));
    assertEquals(r.status, 200);
    assertEquals(await r.text(), resultado);
  });
}
