// Cliente Supabase com o JWT do próprio pedido: toda leitura passa pelo RLS do usuário.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

export function clienteDoUsuario(authorization: string) {
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) throw new Error("faltam SUPABASE_URL e SUPABASE_ANON_KEY");
  return createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Tipo mínimo do que as consultas usam: permite um sb falso nos testes.
// deno-lint-ignore no-explicit-any
export type Sb = {
  from(tabela: string): any;
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: any; error: unknown }>;
  auth: { getUser(): Promise<{ data: { user: any }; error: unknown }> };
};

// E-mail só segue se confirmado: não pré-preenche o checkout com endereço não verificado.
export async function usuarioDoJwt(
  sb: Sb,
): Promise<{ id: string; email?: string } | null> {
  const { data, error } = await sb.auth.getUser();
  const u = data?.user;
  if (error || !u) return null;
  return { id: u.id, email: u.email_confirmed_at ? u.email : undefined };
}

// Erro de consulta vira exceção (500), nunca "não encontrado".
export function dados<T>({ data, error }: { data: T; error: unknown }): T {
  if (error) throw new Error("consulta falhou");
  return data;
}

// Limite de chamadas no banco (public.consumir_limite): true = pode seguir, false = excedeu.
// Erro do RPC lança (500): nunca libera a chamada por falha.
export async function consumirLimiteDb(
  sb: Sb,
  acao: string,
): Promise<boolean> {
  // Só a ação: max e janela são do banco (o cliente não escolhe).
  const { data, error } = await sb.rpc("consumir_limite", { p_acao: acao });
  if (error || typeof data !== "boolean") throw new Error("limite falhou");
  return data;
}
