import { vi } from "vitest"

// Só para testes: supabase falso, encadeável. `tabelas[nome]` = resposta { data, error } (ou função da operação: select/insert/delete).
// O comportamento sob RLS de verdade é provado no pgTAP e no banco local; aqui só o que a tela faz com cada resposta.
type Resp = { data: unknown; error: unknown }
export const falso = {
  tabelas: {} as Record<string, Resp | ((op: string) => Resp)>,
  rpc: vi.fn(),
  invoke: vi.fn(),
  chamadas: [] as { tabela: string; op: string; args: unknown[] }[],
}
export const zerar = () => {
  falso.tabelas = {}
  falso.chamadas = []
  falso.rpc.mockReset()
  falso.rpc.mockResolvedValue({ data: [], error: null })
  falso.invoke.mockReset()
}

function consulta(tabela: string) {
  let op = "select"
  const resposta = (): Resp => {
    const r = falso.tabelas[tabela] ?? { data: [], error: null }
    return typeof r === "function" ? r(op) : r
  }
  const q: Record<string, unknown> = {}
  for (const m of ["select", "eq", "neq", "in", "not", "lte", "order", "limit", "insert", "delete"]) {
    q[m] = (...args: unknown[]) => {
      if (m === "insert" || m === "delete") op = m
      falso.chamadas.push({ tabela, op: m, args })
      return q
    }
  }
  q.maybeSingle = () => {
    const r = resposta()
    return Promise.resolve({ ...r, data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data })
  }
  q.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(resposta()).then(ok, ko)
  return q
}

export const moduloFalso = { supabase: { from: consulta, rpc: falso.rpc, functions: { invoke: falso.invoke }, auth: {} } }

// Sessão e acesso falsos (useAuth e AcessoContext) e montagem sob /:lang.
export const estado = { sessao: null as null | { user: { id: string; email: string } } }
export const moduloSessao = { useAuth: () => ({ sessao: estado.sessao, carregando: false }), sair: vi.fn() }
