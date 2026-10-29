import { deepEqual, equal, rejects } from "node:assert/strict";
import { ErroStripe, stripeDelete } from "../_shared/stripe-api.ts";

const chamar = (r: Response) => {
  const vistas: { url: string; init: RequestInit }[] = [];
  const p = stripeDelete("/v1/subscriptions/sub_1", {
    prorate: false,
    invoice_now: false,
  }, {
    chave: "chave_falsa_conta_1",
    fetch: (
      url,
      init,
    ) => (vistas.push({ url: String(url), init: init! }), Promise.resolve(r)),
  });
  return { p, vistas };
};

Deno.test("stripeDelete: DELETE com chave e parâmetros no corpo", async () => {
  const { p, vistas } = chamar(Response.json({ id: "sub_1" }));
  deepEqual(await p, { id: "sub_1" });
  equal(vistas[0].url, "https://api.stripe.com/v1/subscriptions/sub_1");
  equal(vistas[0].init.method, "DELETE");
  equal(vistas[0].init.body, "prorate=false&invoice_now=false");
  equal(
    (vistas[0].init.headers as Record<string, string>).Authorization,
    "Bearer chave_falsa_conta_1",
  );
});

Deno.test("stripeDelete: 404 resource_missing é ok; outras falhas lançam sem o corpo", async () => {
  deepEqual(
    await chamar(
      Response.json({ error: { code: "resource_missing" } }, { status: 404 }),
    ).p,
    {},
  );
  for (
    const r of [
      new Response("dado pessoal", { status: 500 }),
      new Response("dado pessoal", { status: 404 }),
      Response.json({ error: { code: "x" } }, { status: 404 }),
      new Response("dado pessoal", { status: 401 }),
    ]
  ) {
    await rejects(
      chamar(r).p,
      (e: Error) =>
        e instanceof ErroStripe && !e.message.includes("dado pessoal"),
    );
  }
});
