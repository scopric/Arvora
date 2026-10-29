import { deepEqual, equal, ok, rejects } from "node:assert/strict";
import { filtros, sbFalso } from "../_shared/sb-falso.ts";
import { consultas } from "./consultas.ts";

const UID = "00000000-0000-0000-0000-0000000000aa";

Deno.test("consultas excluir-conta: equipe e assinaturas filtram perfil_id do usuário", async () => {
  const { sb, chamadas } = sbFalso((c) => ({
    data: c.tabela === "equipe" ? [{ perfil_id: UID }] : [
      { stripe_subscription_id: "sub_1", conta_stripe_id: 1 },
      { stripe_subscription_id: null, conta_stripe_id: 1 },
    ],
    error: null,
  }));
  const db = consultas(sb);
  equal(await db.temEquipe(UID), true);
  deepEqual(await db.assinaturasVigentes(UID), [
    { stripe_subscription_id: "sub_1", conta_stripe_id: 1 },
  ]);
  for (const c of chamadas) {
    ok(filtros(c).includes(`perfil_id=${UID}`), c.tabela);
  }
  deepEqual(chamadas[1].passos.find(([m]) => m === "in")![1], ["status", [
    "active",
    "trialing",
    "past_due",
  ]]);
});

Deno.test("consultas excluir-conta: sem linhas = não é equipe e sem assinatura", async () => {
  const db = consultas(sbFalso(() => ({ data: [], error: null })).sb);
  equal(await db.temEquipe(UID), false);
  deepEqual(await db.assinaturasVigentes(UID), []);
});

Deno.test("consultas excluir-conta: erro de consulta lança, nunca vira vazio", async () => {
  const db = consultas(
    sbFalso(() => ({ data: null, error: { message: "boom" } })).sb,
  );
  await rejects(() => db.temEquipe(UID));
  await rejects(() => db.assinaturasVigentes(UID));
});

Deno.test("consultas excluir-conta: usuário traz e-mail cru (não confirmado) e TOTP verificado", async () => {
  const user = (factors: unknown[]) => ({
    id: UID,
    email: "n@exemplo.test",
    email_confirmed_at: null,
    factors,
  });
  const q = (u: unknown) =>
    consultas(sbFalso(() => ({ data: null, error: null }), u).sb);
  deepEqual(await q(user([])).usuario(), {
    id: UID,
    email: "n@exemplo.test",
    totp: false,
  });
  equal(
    (await q(user([{ factor_type: "totp", status: "unverified" }])).usuario())!
      .totp,
    false,
  );
  equal(
    (await q(user([{ factor_type: "totp", status: "verified" }])).usuario())!
      .totp,
    true,
  );
  equal(await q(null).usuario(), null);
});

Deno.test("consultas excluir-conta: consumirLimite chama o RPC e só aceita boolean", async () => {
  const { sb, chamadas } = sbFalso(() => ({ data: true, error: null }));
  equal(await consultas(sb).consumirLimite("excluir_senha"), true);
  deepEqual(chamadas[0].passos[0], ["rpc", [{ p_acao: "excluir_senha" }]]);
  await rejects(
    consultas(sbFalso(() => ({ data: null, error: null })).sb).consumirLimite(
      "excluir_senha",
    ),
  );
});
