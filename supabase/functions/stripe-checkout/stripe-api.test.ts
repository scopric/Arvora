import { deepEqual, equal } from "node:assert/strict";
import { codificarForm } from "../_shared/stripe-api.ts";

Deno.test("codificarForm: chaves aninhadas no formato do Stripe", () => {
  const s = codificarForm({
    mode: "subscription",
    line_items: [{ price: "price_x", quantity: 1 }],
    meta: { a: "b c" },
    nada: undefined,
  });
  equal(
    s,
    "mode=subscription&line_items%5B0%5D%5Bprice%5D=price_x&line_items%5B0%5D%5Bquantity%5D=1&meta%5Ba%5D=b+c",
  );
  deepEqual([...new URLSearchParams(s).keys()], [
    "mode",
    "line_items[0][price]",
    "line_items[0][quantity]",
    "meta[a]",
  ]);
});
