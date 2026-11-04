import { deepEqual, equal, ok } from "node:assert/strict";
import { type Deps, handle } from "./handler.ts";

const SITE = "https://site.exemplo";
const ENV: Record<string, string> = {
  SITE_URL: SITE,
  GOOGLE_MEET_CLIENT_ID: "id_falso",
  GOOGLE_MEET_CLIENT_SECRET: "segredo_falso",
  GOOGLE_MEET_REFRESH_TOKEN: "refresh_falso",
};

// JWT falso só com o claim aal (o handler não verifica assinatura; o getUser real faz isso).
const jwt = (aal: string) => `x.${btoa(JSON.stringify({ aal }))}.y`;
const req = (aal = "aal2", metodo = "POST") =>
  new Request("https://f.exemplo/criar-sala-meet", {
    method: metodo,
    headers: { Authorization: `Bearer ${jwt(aal)}` },
  });

function montar(
  o: {
    papel?: string | null;
    env?: Record<string, string>;
    google?: (url: string) => Response;
  } = {},
) {
  const chamadas: { url: string; init?: RequestInit }[] = [];
  const deps: Deps = {
    env: (n) => (o.env ?? ENV)[n],
    db: () => ({
      usuario: () => Promise.resolve({ id: "u1" }),
      papel: () => Promise.resolve(o.papel === undefined ? "editor" : o.papel),
    }),
    fetch: (url, init) => {
      chamadas.push({ url: String(url), init });
      return Promise.resolve(
        (o.google ??
          ((u) =>
            u.includes("oauth2")
              ? Response.json({ access_token: "tok_falso" })
              : Response.json({
                name: "spaces/abc",
                meetingUri: "https://meet.google.com/abc-defg-hij",
              })))(String(url)),
      );
    },
  };
  return { deps, chamadas };
}

Deno.test("papel que não edita aulas: 403, sem chamar o Google", async () => {
  for (const papel of ["corretor", "moderador", "auditor", null]) {
    const { deps, chamadas } = montar({ papel });
    const r = await handle(req(), deps);
    equal(r.status, 403);
    equal(chamadas.length, 0);
  }
});

Deno.test("editor sem aal2: 403", async () => {
  const { deps, chamadas } = montar();
  equal((await handle(req("aal1"), deps)).status, 403);
  equal(chamadas.length, 0);
});

Deno.test("sem Authorization: 401; método errado: 405", async () => {
  const { deps } = montar();
  equal(
    (await handle(new Request("https://f.exemplo", { method: "POST" }), deps))
      .status,
    401,
  );
  equal((await handle(req("aal2", "GET"), deps)).status, 405);
});

Deno.test("sem segredo do Google: 503 meet_nao_configurado", async () => {
  const { GOOGLE_MEET_REFRESH_TOKEN: _, ...env } = ENV;
  const { deps } = montar({ env });
  const r = await handle(req(), deps);
  equal(r.status, 503);
  deepEqual(await r.json(), { erro: "meet_nao_configurado" });
});

Deno.test("sucesso: devolve o meetingUri e pede sala OPEN com o token", async () => {
  const { deps, chamadas } = montar();
  const r = await handle(req(), deps);
  equal(r.status, 200);
  deepEqual(await r.json(), { url: "https://meet.google.com/abc-defg-hij" });
  const token = new URLSearchParams(String(chamadas[0].init?.body));
  equal(token.get("grant_type"), "refresh_token");
  equal(token.get("refresh_token"), "refresh_falso");
  equal(chamadas[1].url, "https://meet.googleapis.com/v2/spaces");
  const h = chamadas[1].init?.headers as Record<string, string>;
  equal(h.Authorization, "Bearer tok_falso");
  deepEqual(JSON.parse(String(chamadas[1].init?.body)), {
    config: { accessType: "OPEN" },
  });
});

Deno.test("erro do Google (token ou sala): 502 sem vazar o detalhe", async () => {
  for (const falha of ["oauth2", "meet.googleapis"]) {
    const { deps } = montar({
      google: (u) =>
        u.includes(falha)
          ? new Response("DETALHE_SECRETO invalid_grant", { status: 400 })
          : Response.json({ access_token: "t" }),
    });
    const r = await handle(req(), deps);
    equal(r.status, 502);
    const txt = await r.text();
    deepEqual(JSON.parse(txt), { erro: "google" });
    ok(!txt.includes("DETALHE_SECRETO"));
  }
});

Deno.test("resposta do Google com link fora do Meet: 502", async () => {
  const { deps } = montar({
    google: (u) =>
      u.includes("oauth2")
        ? Response.json({ access_token: "t" })
        : Response.json({ meetingUri: "https://mal.exemplo/x" }),
  });
  equal((await handle(req(), deps)).status, 502);
});
