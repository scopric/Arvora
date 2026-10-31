// Só para testes: um supabase falso. Cada `from(tabela)` devolve uma consulta encadeável; ao ser aguardada, responde
// `respostas["tabela.metodo"]` (metodo = insert/update/delete/select, o último usado; `tabela.single` para maybeSingle) ou `respostas["tabela"]`.
// O comportamento real sob RLS é provado no pgTAP do banco; aqui só o que a tela faz com cada resposta.
export type Resposta = { data: unknown; error: unknown; count?: number }
export const chamadas: { tabela: string; metodo: string; args: unknown[] }[] = []

export function criarFalso(respostas: Record<string, Resposta | ((args: unknown[]) => Resposta)>) {
  const achar = (tabela: string, metodo: string, args: unknown[]) => {
    const r = respostas[`${tabela}.${metodo}`] ?? respostas[tabela] ?? { data: [], error: null }
    return typeof r === "function" ? r(args) : r
  }
  const consulta = (tabela: string) => {
    let metodo = "select"
    let args: unknown[] = []
    const q: Record<string, unknown> = {}
    for (const m of ["select", "insert", "update", "delete", "eq", "in", "is", "not", "lt", "gt", "gte", "order", "limit"]) {
      q[m] = (...a: unknown[]) => {
        if (["insert", "update", "delete"].includes(m)) {
          metodo = m
          args = a
          chamadas.push({ tabela, metodo: m, args: a })
        }
        return q
      }
    }
    let unico = false
    const resolver = () => achar(tabela, unico && metodo === "select" ? "single" : metodo, args)
    q.maybeSingle = () => ((unico = true), Promise.resolve(resolver()))
    q.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(resolver()).then(ok, ko)
    return q
  }
  const armazenamento = {
    createSignedUrl: () => Promise.resolve({ data: { signedUrl: "https://exemplo.invalid/arquivo" }, error: null }),
    upload: () => Promise.resolve({ data: {}, error: null }),
    remove: () => Promise.resolve({ data: [], error: null }),
    getPublicUrl: (p: string) => ({ data: { publicUrl: `https://exemplo.invalid/${p}` } }),
  }
  return {
    from: consulta,
    rpc: (nome: string, args: unknown) => (chamadas.push({ tabela: "rpc", metodo: nome, args: [args] }), Promise.resolve(achar(`rpc:${nome}`, "select", [args]))),
    storage: { from: () => armazenamento },
  }
}
