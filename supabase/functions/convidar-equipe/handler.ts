// Convite da equipe por e-mail (ADM-08; PRD 9.1 "convites": inviteUserByEmail, sem tabela).
// Só super_admin com sessão aal2, a mesma regra do RLS de `equipe`. O Supabase cria a conta e manda o e-mail
// (SMTP do Resend, modelo supabase/templates/invite.html); o perfil nasce pelo gatilho criar_perfil e o papel
// entra em `equipe` com o JWT de quem convida, então o RLS confere de novo.
// Conta já confirmada não recebe convite: 409 conta_existe, e a tela manda usar a busca por nome.
// Cadastro não confirmado COM senha: 409 conta_pendente. O convite reaproveitaria a conta e a senha de quem se
// cadastrou com o e-mail continuaria valendo (tomada de conta com papel). Ela confirma o próprio e-mail e entra pela busca.
// Convite ainda pendente (sem senha) reenvia o e-mail e regrava o papel (upsert).
// Nada de e-mail ou nome no log.
import { aalDoJwt } from "../_shared/jwt.ts";
import { cors, json } from "../_shared/stripe-api.ts";

export type Consultas = {
  usuario(): Promise<{ id: string } | null>;
  papel(uid: string): Promise<string | null>;
  gravarPapel(perfil: string, papel: string): Promise<void>;
};
export type Convite = { email: string; nome: string; idioma: "pt" | "en" };
export type Deps = {
  env: (nome: string) => string | undefined;
  db: (authorization: string) => Consultas;
  // id da conta convidada; "existe" = conta confirmada; "pendente" = cadastro não confirmado com senha;
  // "limite" = limite de envio de e-mails do Auth
  convidar: (
    c: Convite,
  ) => Promise<{ id: string } | "existe" | "pendente" | "limite">;
};

const PAPEIS = ["super_admin", "editor", "corretor", "moderador", "auditor"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// deno-lint-ignore no-control-regex
const CONTROLE = /[\u0000-\u001F\u007F]/;

export function lerConvite(b: unknown): (Convite & { papel: string }) | null {
  if (!b || typeof b !== "object") return null;
  const o = b as Record<string, unknown>;
  const email = typeof o.email === "string" ? o.email.trim().toLowerCase() : "";
  const nome = typeof o.nome === "string" ? o.nome.trim() : "";
  const papel = typeof o.papel === "string" ? o.papel : "";
  if (!EMAIL.test(email) || email.length > 254) return null;
  if (!nome || nome.length > 120 || CONTROLE.test(nome)) return null;
  if (!PAPEIS.includes(papel)) return null;
  return { email, nome, papel, idioma: o.idioma === "en" ? "en" : "pt" };
}

export async function handle(req: Request, deps: Deps): Promise<Response> {
  // A tela fica no painel (alpha, Decisão 66): CORS para ADMIN_URL; sem ela (local), SITE_URL.
  const site = deps.env("ADMIN_URL") || deps.env("SITE_URL");
  if (!site) {
    console.error("convidar-equipe: falta a variável ADMIN_URL/SITE_URL");
    return json({ erro: "configuracao" }, 500);
  }
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(site) });
  }
  if (req.method !== "POST") return json({ erro: "metodo" }, 405, site);
  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ erro: "nao_autenticado" }, 401, site);

  const convite = lerConvite(await req.json().catch(() => null));
  try {
    const db = deps.db(authorization);
    const usuario = await db.usuario();
    if (!usuario) return json({ erro: "nao_autenticado" }, 401, site);
    if (
      await db.papel(usuario.id) !== "super_admin" ||
      aalDoJwt(authorization) !== "aal2"
    ) {
      return json({ erro: "sem_permissao" }, 403, site);
    }
    if (!convite) return json({ erro: "entrada" }, 400, site);

    const { papel, ...dados } = convite;
    const r = await deps.convidar(dados);
    if (r === "existe") return json({ erro: "conta_existe" }, 409, site);
    if (r === "pendente") return json({ erro: "conta_pendente" }, 409, site);
    if (r === "limite") return json({ erro: "limite_email" }, 429, site);
    try {
      await db.gravarPapel(r.id, papel);
    } catch {
      // O e-mail já saiu; convidar de novo reenvia e regrava o papel.
      console.error("convidar-equipe: papel não gravado");
      return json({ erro: "papel" }, 500, site);
    }
    return json({ ok: true }, 200, site);
  } catch (e) {
    console.error(
      "convidar-equipe: erro interno",
      e instanceof Error ? e.message : "",
    );
    return json({ erro: "interno" }, 500, site);
  }
}
