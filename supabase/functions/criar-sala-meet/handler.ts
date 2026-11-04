// Cria uma sala no Google Meet (Meet REST API) e devolve o link para o admin colar no campo da aula ao vivo.
// O usuário sai SÓ do JWT. Mesma regra do banco para gravar em `aulas`/`transmissoes`: papel super_admin ou
// editor E sessão aal2 (private.papel_atual() só devolve papel em aal2; o front não é a barreira).
// Credenciais da conta Workspace da Árvora ficam em segredos da função (nunca no repositório). Sem elas: 503.
import { aalDoJwt } from "../_shared/jwt.ts";
import { cors, json } from "../_shared/stripe-api.ts";

export type Consultas = {
  usuario(): Promise<{ id: string } | null>;
  papel(uid: string): Promise<string | null>;
};
export type Deps = {
  env: (nome: string) => string | undefined;
  db: (authorization: string) => Consultas;
  fetch?: typeof fetch;
};

const EDITA = ["super_admin", "editor"];

export async function handle(req: Request, deps: Deps): Promise<Response> {
  // O botão fica no painel (alpha, Decisão 66): o CORS libera ADMIN_URL; sem ela (local, endereço único), SITE_URL.
  const site = deps.env("ADMIN_URL") || deps.env("SITE_URL");
  if (!site) {
    console.error("criar-sala-meet: falta a variável ADMIN_URL/SITE_URL");
    return json({ erro: "configuracao" }, 500);
  }
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(site) });
  }
  if (req.method !== "POST") return json({ erro: "metodo" }, 405, site);
  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ erro: "nao_autenticado" }, 401, site);

  try {
    const db = deps.db(authorization);
    const usuario = await db.usuario();
    if (!usuario) return json({ erro: "nao_autenticado" }, 401, site);
    const papel = await db.papel(usuario.id);
    if (
      !papel || !EDITA.includes(papel) || aalDoJwt(authorization) !== "aal2"
    ) {
      return json({ erro: "sem_permissao" }, 403, site);
    }
  } catch (e) {
    console.error(
      "criar-sala-meet: erro interno",
      e instanceof Error ? e.message : "",
    );
    return json({ erro: "interno" }, 500, site);
  }

  const id = deps.env("GOOGLE_MEET_CLIENT_ID");
  const segredo = deps.env("GOOGLE_MEET_CLIENT_SECRET");
  const refresh = deps.env("GOOGLE_MEET_REFRESH_TOKEN");
  if (!id || !segredo || !refresh) {
    console.error("criar-sala-meet: faltam os segredos GOOGLE_MEET_*");
    return json({ erro: "meet_nao_configurado" }, 503, site);
  }

  // Só o status vai ao log: o corpo do Google pode ter dado da conta.
  const f = deps.fetch ?? fetch;
  try {
    const t = await f("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: id,
        client_secret: segredo,
        refresh_token: refresh,
      }),
    });
    if (!t.ok) {
      await t.body?.cancel();
      console.error(`criar-sala-meet: token respondeu ${t.status}`);
      return json({ erro: "google" }, 502, site);
    }
    const { access_token } = await t.json();
    if (typeof access_token !== "string" || !access_token) {
      console.error("criar-sala-meet: token sem access_token");
      return json({ erro: "google" }, 502, site);
    }

    const r = await f("https://meet.googleapis.com/v2/spaces", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      // ponytail: OPEN = quem tem o link entra sem pedir licença. Aceitável porque o link só sai pela RPC
      // link_transmissao (para quem tem acesso à aula) e a sala é uma por live. TRUSTED faria cada membro
      // externo à organização bater na porta e esperar o anfitrião admitir.
      body: JSON.stringify({ config: { accessType: "OPEN" } }),
    });
    if (!r.ok) {
      await r.body?.cancel();
      console.error(`criar-sala-meet: spaces respondeu ${r.status}`);
      return json({ erro: "google" }, 502, site);
    }
    const { meetingUri } = await r.json();
    if (
      typeof meetingUri !== "string" ||
      !meetingUri.startsWith("https://meet.google.com/")
    ) {
      console.error("criar-sala-meet: resposta sem meetingUri válido");
      return json({ erro: "google" }, 502, site);
    }
    return json({ url: meetingUri }, 200, site);
  } catch {
    console.error("criar-sala-meet: falha de rede com o Google");
    return json({ erro: "google" }, 502, site);
  }
}
