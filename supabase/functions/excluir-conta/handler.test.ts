import { deepEqual, equal, ok } from "node:assert/strict";
import {
  type Assinatura,
  type Consultas,
  type Deps,
  handle,
  UsuarioInexistente,
} from "./handler.ts";

const SITE = "https://site.exemplo";
const UID = "00000000-0000-0000-0000-0000000000aa";
const EMAIL = "Titular@exemplo.test";
const SENHA = "senha_falsa_do_teste";
const CHAVE1 = "chave_falsa_conta_1";
const CHAVE2 = "chave_falsa_conta_2";
const ENV: Record<string, string> = {
  SITE_URL: SITE,
  SUPABASE_URL: "http://supabase.exemplo",
  SUPABASE_ANON_KEY: "anon_falsa",
  SUPABASE_SERVICE_ROLE_KEY: "service_falsa",
  STRIPE_SECRET_KEY_1: CHAVE1,
  STRIPE_SECRET_KEY_2: CHAVE2,
};

function montar(o: {
  assinaturas?: Assinatura[];
  equipe?: boolean;
  senhaOk?: boolean;
  env?: Record<string, string>;
  stripe?: (n: number) => Response | Promise<Response>;
  falhaApagar?: boolean;
  totp?: boolean;
  naoExiste?: boolean;
  semConfirmar?: boolean;
  limite?: boolean | "erro";
} = {}) {
  const ordem: string[] = [];
  const limites: string[] = [];
  const stripe: { url: string; init: RequestInit; corpo: URLSearchParams }[] =
    [];
  const db: Consultas = {
    usuario: () =>
      Promise.resolve({
        id: UID,
        email: "titular@exemplo.test",
        totp: o.totp ?? false,
      }),
    consumirLimite: (a) => {
      limites.push(a);
      return o.limite === "erro"
        ? Promise.reject(new Error("rpc falhou"))
        : Promise.resolve(o.limite ?? true);
    },
    temEquipe: () => Promise.resolve(o.equipe ?? false),
    assinaturasVigentes: () => Promise.resolve(o.assinaturas ?? []),
  };
  const deps: Deps = {
    agora: () => AGORA,
    env: (n) => (o.env ?? ENV)[n],
    db: () => db,
    senhaConfere: (_u, _a, email, senha) => {
      ordem.push(`senha:${email}`);
      return Promise.resolve((o.senhaOk ?? true) && senha === SENHA);
    },
    apagarUsuario: (_u, _s, uid) => {
      ordem.push(`apagar:${uid}`);
      if (o.naoExiste) return Promise.reject(new UsuarioInexistente());
      return o.falhaApagar
        ? Promise.reject(new Error("detalhe interno secreto"))
        : Promise.resolve();
    },
    fetch: async (url, init) => {
      const corpo = new URLSearchParams(String(init!.body));
      stripe.push({ url: String(url), init: init!, corpo });
      ordem.push(`stripe:${init!.method}:${new URL(String(url)).pathname}`);
      return await (o.stripe?.(stripe.length) ??
        Response.json({ id: "sub", status: "canceled" }));
    },
  };
  return { deps, ordem, stripe, limites };
}

const jwt = (aal: string) =>
  `Bearer h.${btoa(JSON.stringify({ aal })).replace(/=+$/, "")}.s`;
const post = (corpo: unknown, metodo = "POST", auth = "Bearer jwt_falso") =>
  new Request("https://fn.exemplo/excluir-conta", {
    method: metodo,
    headers: { Authorization: auth },
    body: metodo === "POST"
      ? (typeof corpo === "string" ? corpo : JSON.stringify(corpo))
      : undefined,
  });
const corpoOk = { email: EMAIL, senha: SENHA };
const AGORA = Date.parse("2026-11-30T12:00:00Z");
const DIA = 24 * 60 * 60 * 1000;
const haDias = (d: number) => new Date(AGORA - d * DIA).toISOString();
const sub = (n: number, dias: number): Assinatura => ({
  stripe_subscription_id: `sub_${n}`,
  conta_stripe_id: n,
  criado_em: haDias(dias),
});
const DUAS: Assinatura[] = [sub(1, 30), sub(2, 40)];

// Captura tudo que a função loga, para provar que senha e chave nunca aparecem.
async function comLog<T>(f: () => Promise<T>): Promise<[T, string]> {
  const linhas: string[] = [];
  const orig = { e: console.error, l: console.log, w: console.warn };
  console.error = console.log = console.warn = (...a: unknown[]) =>
    linhas.push(a.map(String).join(" "));
  try {
    return [await f(), linhas.join("\n")];
  } finally {
    console.error = orig.e;
    console.log = orig.l;
    console.warn = orig.w;
  }
}

Deno.test("feliz sem assinatura: confere senha, apaga, nada no Stripe", async () => {
  const { deps, ordem, stripe } = montar();
  const r = await handle(post(corpoOk), deps);
  equal(r.status, 200);
  deepEqual(await r.json(), { ok: true });
  equal(r.headers.get("Access-Control-Allow-Origin"), SITE);
  equal(stripe.length, 0);
  deepEqual(ordem, [`senha:titular@exemplo.test`, `apagar:${UID}`]);
});

Deno.test("feliz com 2 assinaturas em 2 contas: DELETE por conta, depois apagar", async () => {
  const { deps, ordem, stripe } = montar({ assinaturas: DUAS });
  const r = await handle(post(corpoOk), deps);
  equal(r.status, 200);
  deepEqual(ordem, [
    "senha:titular@exemplo.test",
    "stripe:DELETE:/v1/subscriptions/sub_1",
    "stripe:DELETE:/v1/subscriptions/sub_2",
    `apagar:${UID}`,
  ]);
  const h = (i: number) => stripe[i].init.headers as Record<string, string>;
  equal(h(0).Authorization, `Bearer ${CHAVE1}`);
  equal(h(1).Authorization, `Bearer ${CHAVE2}`);
  for (const s of stripe) {
    equal(s.init.method, "DELETE");
    equal(s.corpo.get("prorate"), "false");
    equal(s.corpo.get("invoice_now"), "false");
  }
});

Deno.test("e-mail diferente (ou ausente): 400 e nada chamado", async () => {
  const { deps, ordem, stripe } = montar({ assinaturas: DUAS });
  const r = await handle(
    post({ email: "outro@exemplo.test", senha: SENHA }),
    deps,
  );
  equal(r.status, 400);
  deepEqual(await r.json(), { erro: "email_diferente" });
  deepEqual(ordem, []);
  equal(stripe.length, 0);
});

Deno.test("e-mail compara sem diferenciar maiúsculas", async () => {
  const { deps } = montar();
  const r = await handle(
    post({ email: "  TITULAR@EXEMPLO.TEST ", senha: SENHA }),
    deps,
  );
  equal(r.status, 200);
});

Deno.test("senha inválida: 401 e nada chamado depois", async () => {
  const { deps, ordem, stripe } = montar({ assinaturas: DUAS });
  const r = await handle(post({ email: EMAIL, senha: "errada" }), deps);
  equal(r.status, 401);
  deepEqual(await r.json(), { erro: "senha_invalida" });
  deepEqual(ordem, ["senha:titular@exemplo.test"]);
  equal(stripe.length, 0);
});

Deno.test("usuário da equipe: 409 e nada chamado depois", async () => {
  const { deps, ordem, stripe } = montar({ equipe: true, assinaturas: DUAS });
  const r = await handle(post(corpoOk), deps);
  equal(r.status, 409);
  deepEqual(await r.json(), { erro: "equipe" });
  deepEqual(ordem, ["senha:titular@exemplo.test"]);
  equal(stripe.length, 0);
});

Deno.test("Stripe falha: 502 e o usuário NÃO é apagado", async () => {
  const { deps, ordem } = montar({
    assinaturas: DUAS,
    stripe: () => new Response("{}", { status: 500 }),
  });
  const r = await handle(post(corpoOk), deps);
  equal(r.status, 502);
  deepEqual(await r.json(), { erro: "stripe" });
  ok(!ordem.some((o) => o.startsWith("apagar")));
  equal(ordem.filter((o) => o.startsWith("stripe")).length, 1); // aborta no primeiro
});

Deno.test("falha de rede no Stripe: 502 e o usuário NÃO é apagado", async () => {
  const { deps, ordem } = montar({
    assinaturas: DUAS,
    stripe: () => Promise.reject(new TypeError("rede")),
  });
  const r = await handle(post(corpoOk), deps);
  equal(r.status, 502);
  ok(!ordem.some((o) => o.startsWith("apagar")));
});

Deno.test("Stripe 404 resource_missing = já cancelada: segue e apaga", async () => {
  const { deps, ordem } = montar({
    assinaturas: DUAS,
    stripe: () =>
      Response.json({ error: { code: "resource_missing" } }, { status: 404 }),
  });
  const r = await handle(post(corpoOk), deps);
  equal(r.status, 200);
  equal(ordem.at(-1), `apagar:${UID}`);
});

Deno.test("Stripe 404 de outro tipo: aborta", async () => {
  const { deps, ordem } = montar({
    assinaturas: DUAS,
    stripe: () => Response.json({ error: { code: "outro" } }, { status: 404 }),
  });
  const r = await handle(post(corpoOk), deps);
  equal(r.status, 502);
  ok(!ordem.some((o) => o.startsWith("apagar")));
});

Deno.test("sem chave de uma das contas: 500 e NADA é cancelado nem apagado", async () => {
  const { STRIPE_SECRET_KEY_2: _, ...semChave2 } = ENV;
  const { deps, ordem, stripe } = montar({
    assinaturas: DUAS,
    env: semChave2,
  });
  const r = await handle(post(corpoOk), deps);
  equal(r.status, 500);
  deepEqual(await r.json(), { erro: "configuracao" });
  equal(stripe.length, 0);
  ok(!ordem.some((o) => o.startsWith("apagar")));
});

Deno.test("sem SITE_URL ou sem variáveis do Supabase: 500", async () => {
  for (
    const faltando of ["SITE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_URL"]
  ) {
    const env = { ...ENV };
    delete env[faltando];
    const { deps, ordem } = montar({ env });
    const r = await handle(post(corpoOk), deps);
    equal(r.status, 500, faltando);
    deepEqual(ordem, []);
  }
});

Deno.test("falha no deleteUser: 500 exclusao, sem detalhe interno", async () => {
  const { deps } = montar({ assinaturas: DUAS, falhaApagar: true });
  const [r, log] = await comLog(() => handle(post(corpoOk), deps));
  equal(r.status, 500);
  const texto = await r.text();
  equal(texto, '{"erro":"exclusao"}');
  ok(!log.includes("detalhe interno secreto"));
});

Deno.test("método, JSON e corpo inválidos", async () => {
  const { deps, ordem } = montar();
  equal((await handle(post(null, "GET"), deps)).status, 405);
  equal((await handle(post("{nao json"), deps)).status, 400);
  const longo = "a".repeat(2000);
  for (
    const c of [
      {},
      { email: EMAIL },
      { email: "", senha: SENHA },
      { email: EMAIL, senha: "" },
      { email: 1, senha: SENHA },
      { email: EMAIL, senha: longo },
      { email: longo + "@x.test", senha: SENHA },
      null,
    ]
  ) {
    equal((await handle(post(c), deps)).status, 400, JSON.stringify(c));
  }
  const semAuth = new Request("https://fn.exemplo/x", {
    method: "POST",
    body: JSON.stringify(corpoOk),
  });
  equal((await handle(semAuth, deps)).status, 401);
  deepEqual(ordem, []);
});

Deno.test("senha e chaves nunca aparecem na resposta nem no log", async () => {
  const casos = [
    montar({ assinaturas: DUAS }),
    montar({
      assinaturas: DUAS,
      stripe: () => new Response(`${SENHA} ${CHAVE1}`, { status: 500 }),
    }),
    montar({ falhaApagar: true }),
    montar({ senhaOk: false }),
  ];
  for (const { deps } of casos) {
    const [r, log] = await comLog(() => handle(post(corpoOk), deps));
    const texto = await r.text();
    for (
      const segredo of [SENHA, CHAVE1, CHAVE2, "service_falsa", "jwt_falso"]
    ) {
      ok(!texto.includes(segredo) && !log.includes(segredo), segredo);
    }
  }
});

Deno.test("TOTP verificado com aal1: 403 mfa_requerido e NADA chamado", async () => {
  const { deps, ordem, stripe } = montar({ totp: true, assinaturas: DUAS });
  for (const auth of [jwt("aal1"), "Bearer jwt_falso"]) {
    const r = await handle(post(corpoOk, "POST", auth), deps);
    equal(r.status, 403);
    deepEqual(await r.json(), { erro: "mfa_requerido" });
  }
  deepEqual(ordem, []);
  equal(stripe.length, 0);
});

Deno.test("TOTP com aal2 segue; sem TOTP com aal1 segue", async () => {
  for (const [totp, aal] of [[true, "aal2"], [false, "aal1"]] as const) {
    const { deps, ordem } = montar({ totp });
    const r = await handle(post(corpoOk, "POST", jwt(aal)), deps);
    equal(r.status, 200);
    equal(ordem.at(-1), `apagar:${UID}`);
  }
});

Deno.test("e-mail não confirmado: o e-mail cru vale; e-mail diferente continua 400", async () => {
  // consultas.usuario devolve o e-mail cru (testado em consultas.test.ts); aqui o handler só compara.
  const { deps } = montar();
  equal((await handle(post(corpoOk), deps)).status, 200);
  equal(
    (await handle(post({ email: "outro@exemplo.test", senha: SENHA }), deps))
      .status,
    400,
  );
});

Deno.test("deleteUser com usuário já apagado (corrida de abas): 200 ok", async () => {
  const { deps } = montar({ naoExiste: true });
  const r = await handle(post(corpoOk), deps);
  equal(r.status, 200);
  deepEqual(await r.json(), { ok: true });
});

Deno.test("limite: dentro do limite segue e confere a senha; ação excluir_senha", async () => {
  const { deps, ordem, limites } = montar();
  const r = await handle(post(corpoOk), deps);
  equal(r.status, 200);
  deepEqual(limites, ["excluir_senha"]);
  equal(ordem[0], "senha:titular@exemplo.test");
});

Deno.test("limite: senha errada também consome", async () => {
  const { deps, limites } = montar();
  const r = await handle(post({ email: EMAIL, senha: "errada" }), deps);
  equal(r.status, 401);
  deepEqual(limites, ["excluir_senha"]);
});

Deno.test("limite: excedeu é 429 com Retry-After e nada é chamado", async () => {
  const { deps, ordem, stripe } = montar({ limite: false, assinaturas: DUAS });
  const r = await handle(post(corpoOk), deps);
  equal(r.status, 429);
  deepEqual(await r.json(), { erro: "limite" });
  equal(r.headers.get("Retry-After"), "3600");
  deepEqual(ordem, []);
  equal(stripe.length, 0);
});

Deno.test("limite: erro do contador é 500 interno e nada é chamado", async () => {
  const { deps, ordem, stripe } = montar({ limite: "erro", assinaturas: DUAS });
  const r = await handle(post(corpoOk), deps);
  equal(r.status, 500);
  deepEqual(await r.json(), { erro: "interno" });
  deepEqual(ordem, []);
  equal(stripe.length, 0);
});

Deno.test("limite: e-mail diferente e mfa_requerido não consomem", async () => {
  const a = montar();
  equal(
    (await handle(post({ email: "outro@exemplo.test", senha: SENHA }), a.deps))
      .status,
    400,
  );
  deepEqual(a.limites, []);
  const b = montar({ totp: true });
  equal((await handle(post(corpoOk, "POST", jwt("aal1")), b.deps)).status, 403);
  deepEqual(b.limites, []);
});

for (
  const [nome, dias] of [["3 dias", 3], [
    "13 dias e 23 h",
    13 + 23 / 24,
  ]] as const
) {
  Deno.test(`arrependimento: vigente com ${nome}: 409 e nada chamado depois`, async () => {
    const { deps, ordem, stripe } = montar({ assinaturas: [sub(1, dias)] });
    const r = await handle(post(corpoOk), deps);
    equal(r.status, 409);
    deepEqual(await r.json(), { erro: "arrependimento" });
    deepEqual(ordem, ["senha:titular@exemplo.test"]);
    equal(stripe.length, 0);
  });
}

for (const dias of [14, 30]) {
  Deno.test(`arrependimento: vigente com ${dias} dias segue e cancela`, async () => {
    const { deps, ordem, stripe } = montar({ assinaturas: [sub(1, dias)] });
    const r = await handle(post(corpoOk), deps);
    equal(r.status, 200);
    equal(stripe.length, 1);
    ok(ordem.includes(`apagar:${UID}`));
  });
}

Deno.test("arrependimento: uma de 3 dias e outra de 40: 409 e nada cancelado", async () => {
  const { deps, ordem, stripe } = montar({
    assinaturas: [sub(1, 40), sub(2, 3)],
  });
  const r = await handle(post(corpoOk), deps);
  equal(r.status, 409);
  deepEqual(await r.json(), { erro: "arrependimento" });
  equal(stripe.length, 0);
  ok(!ordem.some((o) => o.startsWith("apagar")));
});

Deno.test("arrependimento: data inválida conta como recente (409)", async () => {
  const { deps } = montar({
    assinaturas: [{ ...sub(1, 30), criado_em: "lixo" }],
  });
  equal((await handle(post(corpoOk), deps)).status, 409);
});

Deno.test("arrependimento: ordem, e-mail/senha/equipe respondem antes", async () => {
  const recente = [sub(1, 3)];
  const a = montar({ assinaturas: recente });
  equal(
    (await handle(post({ email: "outro@exemplo.test", senha: SENHA }), a.deps))
      .status,
    400,
  );
  const b = montar({ assinaturas: recente, senhaOk: false });
  equal((await handle(post(corpoOk), b.deps)).status, 401);
  const c = montar({ assinaturas: recente, equipe: true });
  deepEqual(await (await handle(post(corpoOk), c.deps)).json(), {
    erro: "equipe",
  });
});

Deno.test("arrependimento: o 409 vem antes de conferir as chaves do Stripe", async () => {
  const { deps } = montar({
    assinaturas: [sub(1, 3)],
    env: { ...ENV, STRIPE_SECRET_KEY_1: "" },
  });
  equal((await handle(post(corpoOk), deps)).status, 409);
});
