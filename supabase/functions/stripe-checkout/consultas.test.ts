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
  equal(await db.temAssinaturaVigente(UID, 2), true);
  for (const c of chamadas) {
    ok(
      filtros(c).includes(`perfil_id=${UID}`) &&
        filtros(c).includes("conta_stripe_id=2"),
      c.tabela,
    );
  }
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
  await rejects(db.temAssinaturaVigente(UID, 1));
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
