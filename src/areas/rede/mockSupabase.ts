// Só para testes: supabase falso com respostas por tabela/RPC e registro das escritas. O RLS de verdade é testado no pgTAP.
type R = { data: unknown; error: unknown }
export const resp = {
  tabelas: {} as Record<string, R>,
  escritas: {} as Record<string, R>, // chave "tabela.insert|update|delete"
  rpc: {} as Record<string, R>,
  chamadas: [] as { onde: string; args: unknown }[],
}
export function zerar() {
  resp.tabelas = {}
  resp.escritas = {}
  resp.rpc = {}
  resp.chamadas = []
}
const OK_ESCRITA: R = { data: [{ id: 1 }], error: null }

function consulta(tabela: string) {
  let escrita: string | null = null
  const q: Record<string, unknown> = {}
  for (const m of ["select", "eq", "neq", "in", "lte", "or", "order", "limit"]) q[m] = () => q
  for (const op of ["insert", "update", "delete"]) q[op] = (args: unknown) => ((escrita = op), resp.chamadas.push({ onde: `${tabela}.${op}`, args }), q)
  const valor = () => (escrita ? (resp.escritas[`${tabela}.${escrita}`] ?? OK_ESCRITA) : (resp.tabelas[tabela] ?? { data: [], error: null }))
  q.maybeSingle = () => {
    const v = valor()
    return Promise.resolve(Array.isArray(v.data) ? { ...v, data: v.data[0] ?? null } : v)
  }
  q.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(valor()).then(ok, ko)
  return q
}

export const mockSupabase = {
  supabase: {
    from: consulta,
    rpc: (nome: string, args: unknown) => (resp.chamadas.push({ onde: `rpc.${nome}`, args }), Promise.resolve(resp.rpc[nome] ?? { data: [], error: null })),
    storage: { from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: `https://img.invalid/${p}` } }) }) },
  },
}
