import { deepEqual, equal } from "node:assert/strict";
import { type Convite, type Deps, handle } from "./handler.ts";

const ENV: Record<string, string> = { SITE_URL: "https://site.exemplo" };
const CORPO = { email: " Ana@Exemplo.invalid ", nome: "Ana", papel: "editor" };

// JWT falso só com o claim aal (o handler não verifica assinatura; o getUser real faz isso).
const jwt = (aal: string) => `x.${btoa(JSON.stringify({ aal }))}.y`;
const req = (corpo: unknown = CORPO, aal = "aal2") =>
  new Request("https://f.exemplo/convidar-equipe", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt(aal)}` },
    body: JSON.stringify(corpo),
  });

function montar(
  o: {
    papel?: string | null;
    convite?: { id: string } | "existe" | "pendente" | "limite";
    gravar?: () => Promise<void>;
  } = {},
) {
  const convites: Convite[] = [];
  const gravados: [string, string][] = [];
  const deps: Deps = {
    env: (n) => ENV[n],
    db: () => ({
      usuario: () => Promise.resolve({ id: "u1" }),
      papel: () =>
        Promise.resolve(o.papel === undefined ? "super_admin" : o.papel),
      gravarPapel: (p, papel) => {
        gravados.push([p, papel]);
        return o.gravar ? o.gravar() : Promise.resolve();
      },
    }),
    convidar: (c) => {
      convites.push(c);
      return Promise.resolve(o.convite ?? { id: "novo" });
    },
  };
  return { deps, convites, gravados };
}

Deno.test("super_admin com aal2: convida com e-mail normalizado e grava o papel", async () => {
  const { deps, convites, gravados } = montar();
  const r = await handle(req(), deps);
  equal(r.status, 200);
  deepEqual(convites, [{
    email: "ana@exemplo.invalid",
    nome: "Ana",
    idioma: "pt",
  }]);
  deepEqual(gravados, [["novo", "editor"]]);
});

Deno.test("quem não é super_admin, ou sem aal2: 403, sem convite", async () => {
  for (const papel of ["editor", "corretor", "moderador", "auditor", null]) {
    const { deps, convites } = montar({ papel });
    equal((await handle(req(), deps)).status, 403);
    equal(convites.length, 0);
  }
  const { deps, convites } = montar();
  equal((await handle(req(CORPO, "aal1"), deps)).status, 403);
  equal(convites.length, 0);
});

Deno.test("entrada inválida: 400, sem convite", async () => {
  for (
    const corpo of [
      { ...CORPO, email: "sem-arroba" },
      { ...CORPO, nome: " " },
      { ...CORPO, nome: "A\nB" },
      { ...CORPO, papel: "dono" },
      null,
    ]
  ) {
    const { deps, convites } = montar();
    equal((await handle(req(corpo), deps)).status, 400);
    equal(convites.length, 0);
  }
});

Deno.test("conta já confirmada: 409 conta_existe, sem gravar papel", async () => {
  const { deps, gravados } = montar({ convite: "existe" });
  const r = await handle(req(), deps);
  equal(r.status, 409);
  deepEqual(await r.json(), { erro: "conta_existe" });
  equal(gravados.length, 0);
});

Deno.test("cadastro pendente com senha: 409 conta_pendente, sem gravar papel", async () => {
  const { deps, gravados } = montar({ convite: "pendente" });
  const r = await handle(req(), deps);
  equal(r.status, 409);
  deepEqual(await r.json(), { erro: "conta_pendente" });
  equal(gravados.length, 0);
});

Deno.test("limite de e-mails do Auth: 429 limite_email", async () => {
  const { deps, gravados } = montar({ convite: "limite" });
  const r = await handle(req(), deps);
  equal(r.status, 429);
  deepEqual(await r.json(), { erro: "limite_email" });
  equal(gravados.length, 0);
});

Deno.test("papel recusado pelo banco: 500 papel", async () => {
  const { deps } = montar({ gravar: () => Promise.reject(new Error("rls")) });
  const r = await handle(req(), deps);
  equal(r.status, 500);
  deepEqual(await r.json(), { erro: "papel" });
});

Deno.test("sem Authorization: 401", async () => {
  const { deps } = montar();
  const r = await handle(
    new Request("https://f.exemplo/x", { method: "POST", body: "{}" }),
    deps,
  );
  equal(r.status, 401);
});
