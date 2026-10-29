// Só para testes: sb falso que registra cada consulta encadeada e devolve a resposta configurada.
import type { Sb } from "./supabase-usuario.ts";

export type Chamada = { tabela: string; passos: [string, unknown[]][] };

export function sbFalso(
  resposta: (c: Chamada) => { data: unknown; error: unknown },
  user: unknown = null,
) {
  const chamadas: Chamada[] = [];
  const sb: Sb = {
    auth: {
      getUser: () =>
        Promise.resolve({
          data: { user },
          error: user ? null : { message: "x" },
        }),
    },
    from(tabela: string) {
      const c: Chamada = { tabela, passos: [] };
      chamadas.push(c);
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "order", "limit"]) {
        q[m] = (...a: unknown[]) => (c.passos.push([m, a]), q);
      }
      q.maybeSingle = () => Promise.resolve(resposta(c));
      q.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) =>
        Promise.resolve(resposta(c)).then(ok, ko);
      return q;
    },
  };
  return { sb, chamadas };
}

export const filtros = (c: Chamada) =>
  c.passos.filter(([m]) => m === "eq").map(([, a]) => `${a[0]}=${a[1]}`);
