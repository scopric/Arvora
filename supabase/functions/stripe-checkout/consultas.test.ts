import { deepEqual, equal, ok, rejects } from "node:assert/strict";
import { filtros, sbFalso } from "../_shared/sb-falso.ts";
import { consultas } from "./consultas.ts";

const UID = "00000000-0000-0000-0000-0000000000aa";

Deno.test("consultas checkout: plano só ativo", async () => {
  const { sb, chamadas } = sbFalso(() => ({ data: null, error: null }));
  equal(await consultas(sb).plano(7), null);
  equal(chamadas[0].tabela, "planos");
  deepEqual(filtros(chamadas[0]).sort(), ["ativo=true", "id=7"]);
});

Deno.test("consultas checkout: clientes_stripe e assinaturas sempre filtram perfil_id do usuário", async () => {
  const { sb, chamadas } = sbFalso((c) => ({
    data: c.tabela === "assinaturas"
      ? [{ id: 1 }]
      : { stripe_customer_id: "cus_x" },
    error: null,
  }));
  const db = consultas(sb);
  equal(await db.customer(UID, 2), "cus_x");
  equal(await db.temAssinaturaVigente(UID), true);
  for (const c of chamadas) {
    ok(filtros(c).includes(`perfil_id=${UID}`), c.tabela);
  }
  // clientes_stripe segue filtrando a conta; a regra de assinatura vigente é por perfil, em qualquer conta
  ok(filtros(chamadas[0]).includes("conta_stripe_id=2"));
  deepEqual(filtros(chamadas[1]), [`perfil_id=${UID}`]);
  deepEqual(chamadas[1].passos.find(([m]) => m === "in")![1], ["status", [
    "active",
    "trialing",
    "past_due",
  ]]);
});

Deno.test("consultas checkout: erro de consulta lança, nunca vira não encontrado", async () => {
  const db = consultas(
    sbFalso(() => ({ data: null, error: { message: "boom" } })).sb,
  );
  await rejects(db.plano(7));
  await rejects(db.customer(UID, 1));
  await rejects(db.temAssinaturaVigente(UID));
  await rejects(db.consumirLimite("checkout"));
});

Deno.test("consultas checkout: e-mail só se confirmado", async () => {
  const sem = consultas(
    sbFalso(() => ({ data: null, error: null }), {
      id: UID,
      email: "a@exemplo.invalid",
      email_confirmed_at: null,
    }).sb,
  );
  deepEqual(await sem.usuario(), { id: UID, email: undefined });
  const com = consultas(
    sbFalso(() => ({ data: null, error: null }), {
      id: UID,
      email: "a@exemplo.invalid",
      email_confirmed_at: "2026-01-01",
    }).sb,
  );
  deepEqual(await com.usuario(), { id: UID, email: "a@exemplo.invalid" });
  equal(
    await consultas(sbFalso(() => ({ data: null, error: null })).sb).usuario(),
    null,
  );
});

Deno.test("consultas checkout: consumirLimite chama o RPC e só aceita boolean", async () => {
  const { sb, chamadas } = sbFalso(() => ({ data: false, error: null }));
  equal(await consultas(sb).consumirLimite("checkout"), false);
  // só p_acao: max e janela nunca saem da função
  deepEqual(chamadas[0].passos[0], ["rpc", [{ p_acao: "checkout" }]]);
  await rejects(
    consultas(sbFalso(() => ({ data: null, error: null })).sb).consumirLimite(
      "checkout",
    ),
  );
});
