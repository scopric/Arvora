// Exclusão de conta do titular (GDPR art. 17). O usuário sai SÓ do JWT; o corpo traz e-mail e senha
// para reautenticar (o e-mail do corpo tem de ser o do JWT).
//
// Ordem (e porquê):
//   0. se tem TOTP verificado, o JWT precisa ser aal2 (403 mfa_requerido),
//   1. e-mail igual ao do JWT, 2. senha conferida, 3. bloqueio se for da equipe (um admin remove o papel
//   antes: evita apagar o último super_admin), 4. assinatura vigente com menos de 14 dias: 409 arrependimento
//   (o suporte cancela com reembolso; só depois dos 14 dias o cancelamento sem reembolso vale),
//   5. cancelar no Stripe, 6. só então apagar o usuário.
//   Cancelar ANTES de apagar: se o Stripe falhar, nada é apagado e a pessoa tenta de novo. Se o delete
//   falhar depois, a assinatura já está cancelada no Stripe: aceitável e visível (500 "exclusao").
//   Todas as chaves Stripe são conferidas ANTES do primeiro cancelamento (sem cancelamento pela metade).
//
// Limites conhecidos: (a) conta sem senha (magic link/OAuth, hoje inexistentes) precisa de atendimento manual;
// (b) limite de tentativas de senha por usuário: ação excluir_senha no banco (5 por hora), consumida logo
// antes de cada conferência de senha, certa ou errada. Quem roubar só o JWT consegue bloquear a exclusão da
// vítima por 1 h (risco aceito; o suporte atende).
//
// O que o delete em auth.users faz (FKs): perfis e equipe caem em cascata; assinaturas.perfil_id e
// clientes_stripe.perfil_id viram null.
// DADO RETIDO POR OBRIGAÇÃO LEGAL (retenção fiscal): assinaturas e clientes_stripe ficam, e clientes_stripe
// guarda o e-mail do cliente. Item a validar pelo solicitor (prazo e se o e-mail pode ser anonimizado).
import { cors, ErroStripe, json, stripeDelete } from "../_shared/stripe-api.ts";

export type Assinatura = {
  stripe_subscription_id: string;
  conta_stripe_id: number;
  // Data em que a linha nasceu = proxy da data do contrato. Limitação: renovação não muda criado_em e
  // troca de plano pelo portal mantém a mesma linha. Se o webhook gravar a linha antes do pagamento se
  // confirmar, o prazo começa até cerca de 1 dia antes do contrato: o erro vai para o lado seguro (bloqueia a mais).
  // Fechar de vez exige guardar o `created` da assinatura do Stripe (migration), fora deste escopo.
  criado_em: string;
};
export type Consultas = {
  usuario(): Promise<{ id: string; email?: string; totp: boolean } | null>;
  consumirLimite(acao: string): Promise<boolean>;
  temEquipe(uid: string): Promise<boolean>;
  assinaturasVigentes(uid: string): Promise<Assinatura[]>;
};
export type Deps = {
  env: (nome: string) => string | undefined;
  db: (authorization: string) => Consultas;
  senhaConfere: (
    url: string,
    anon: string,
    email: string,
    senha: string,
  ) => Promise<boolean>;
  apagarUsuario: (
    url: string,
    serviceRole: string,
    uid: string,
  ) => Promise<void>;
  fetch?: typeof fetch;
  agora?: () => number; // relógio injetável (ms); padrão Date.now
};

// O apagarUsuario lança isto quando o usuário já não existe (outra aba apagou antes): conta como sucesso.
export class UsuarioInexistente extends Error {}

// Claim aal do JWT. Sem verificar assinatura: o getUser() já validou o token neste pedido.
export function aalDoJwt(authorization: string): string | undefined {
  try {
    const p = authorization.replace(/^Bearer /i, "").split(".")[1];
    const b = p.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b + "=".repeat((4 - b.length % 4) % 4))).aal;
  } catch {
    return undefined;
  }
}

// Cancelamento imediato SEM reembolso proporcional nem fatura final. Só vale depois dos 14 dias da
// assinatura: antes disso o handler responde 409 arrependimento e o suporte trata o reembolso.
export const CANCELAR_SEM_REEMBOLSO = { prorate: false, invoice_now: false };

// Prazo de arrependimento: 14 dias da conclusão do contrato (Consumer Rights Act 2022, s. 113(2), Irlanda).
// Regra PROVISÓRIA, sujeita a revisão jurídica.
export const PRAZO_ARREPENDIMENTO_DIAS = 14;
const DIA_MS = 24 * 60 * 60 * 1000;

// Limite real (max e janela) é do banco: public.consumir_limite. A janela aqui serve só ao Retry-After;
// mantenha igual ao limite em consumir_limite no banco.
const LIMITE = { acao: "excluir_senha", janelaSeg: 3600 };

const MAX_EMAIL = 254;
const MAX_SENHA = 1024;

export async function handle(req: Request, deps: Deps): Promise<Response> {
  const site = deps.env("SITE_URL");
  if (!site) {
    console.error("excluir-conta: falta a variável SITE_URL");
    return json({ erro: "configuracao" }, 500);
  }
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(site) });
  }
  if (req.method !== "POST") return json({ erro: "metodo" }, 405, site);
  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ erro: "nao_autenticado" }, 401, site);

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return json({ erro: "json_invalido" }, 400, site);
  }
  const { email, senha } = (corpo ?? {}) as Record<string, unknown>;
  if (
    typeof email !== "string" || email.length === 0 ||
    email.length > MAX_EMAIL ||
    typeof senha !== "string" || senha.length === 0 || senha.length > MAX_SENHA
  ) {
    return json({ erro: "entrada_invalida" }, 400, site);
  }

  const url = deps.env("SUPABASE_URL");
  const anon = deps.env("SUPABASE_ANON_KEY");
  const serviceRole = deps.env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !serviceRole) {
    console.error("excluir-conta: faltam variáveis do Supabase");
    return json({ erro: "configuracao" }, 500, site);
  }

  let uid: string;
  let vigentes: Assinatura[];
  try {
    const db = deps.db(authorization);
    const usuario = await db.usuario();
    if (!usuario) return json({ erro: "nao_autenticado" }, 401, site);
    if (usuario.totp && aalDoJwt(authorization) !== "aal2") {
      return json({ erro: "mfa_requerido" }, 403, site);
    }
    if (
      !usuario.email ||
      usuario.email.trim().toLowerCase() !== email.trim().toLowerCase()
    ) {
      return json({ erro: "email_diferente" }, 400, site);
    }
    // Só quando a próxima etapa é testar a senha. Erro do RPC lança (500): nunca libera.
    if (!(await db.consumirLimite(LIMITE.acao))) {
      return json({ erro: "limite" }, 429, site, {
        "Retry-After": String(LIMITE.janelaSeg),
      });
    }
    if (!(await deps.senhaConfere(url, anon, usuario.email, senha))) {
      return json({ erro: "senha_invalida" }, 401, site);
    }
    uid = usuario.id;
    if (await db.temEquipe(uid)) return json({ erro: "equipe" }, 409, site);
    vigentes = await db.assinaturasVigentes(uid);
  } catch (e) {
    console.error(
      "excluir-conta: erro interno",
      e instanceof Error ? e.message : "",
    );
    return json({ erro: "interno" }, 500, site);
  }

  // Menos de 14 dias: a exclusão não acontece sozinha. `!(>=)` trata data inválida como recente.
  const agora = (deps.agora ?? Date.now)();
  if (
    vigentes.some((a) =>
      !(agora - Date.parse(a.criado_em) >= PRAZO_ARREPENDIMENTO_DIAS * DIA_MS)
    )
  ) {
    return json({ erro: "arrependimento" }, 409, site);
  }

  // Sem chave da conta: 500 explícito, sem chave reserva, antes de cancelar qualquer coisa.
  const chaves: string[] = [];
  for (const a of vigentes) {
    const nome = `STRIPE_SECRET_KEY_${a.conta_stripe_id}`;
    const chave = deps.env(nome);
    if (!chave) {
      console.error(`excluir-conta: falta a variável ${nome}`);
      return json({ erro: "configuracao" }, 500, site);
    }
    chaves.push(chave);
  }
  for (const [i, a] of vigentes.entries()) {
    try {
      await stripeDelete(
        `/v1/subscriptions/${encodeURIComponent(a.stripe_subscription_id)}`,
        CANCELAR_SEM_REEMBOLSO,
        { chave: chaves[i], fetch: deps.fetch },
      );
    } catch (e) {
      // Qualquer falha (HTTP ou rede) aborta sem apagar o usuário.
      console.error(
        "excluir-conta:",
        e instanceof ErroStripe ? e.message : "falha de rede no Stripe",
      );
      return json({ erro: "stripe" }, 502, site);
    }
  }

  try {
    await deps.apagarUsuario(url, serviceRole, uid);
  } catch (e) {
    if (e instanceof UsuarioInexistente) return json({ ok: true }, 200, site);
    console.error("excluir-conta: falha ao apagar o usuário");
    return json({ erro: "exclusao" }, 500, site);
  }
  return json({ ok: true }, 200, site);
}
