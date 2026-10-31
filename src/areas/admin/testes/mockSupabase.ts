// Supabase de mentira para os testes das telas do admin. O RLS e as RPCs de verdade são provados no pgTAP; aqui só se vê
// o que a tela faz com cada resposta. `estado.respostas` aceita "tabela:op" (select/insert/update/delete), "tabela" ou "rpc:nome".
export type Chamada = { tabela: string; op: string; args: unknown[] }
type Resp = { data: unknown; error: unknown; count?: number } | ((c: Chamada[]) => { data: unknown; error: unknown; count?: number })
export const estado = { respostas: {} as Record<string, Resp>, chamadas: [] as Chamada[] }
export const reiniciar = () => {
  estado.respostas = {}
  estado.chamadas = []
}
const vazio = { data: [], error: null }
const resolver = (chave: string, outra: string) => {
  const r = estado.respostas[chave] ?? estado.respostas[outra] ?? vazio
  return typeof r === "function" ? r(estado.chamadas) : r
}

function consulta(tabela: string) {
  let op = "select"
  let unico = false
  const metodos = new Set(["insert", "update", "delete", "upsert"])
  const b: Record<string, unknown> = new Proxy({}, {
    get(_, prop: string) {
      if (prop === "then") {
        return (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => {
          const r = resolver(`${tabela}:${op}`, tabela)
          const d = unico && Array.isArray(r.data) ? { ...r, data: r.data[0] ?? null } : r
          return Promise.resolve(d).then(ok, ko)
        }
      }
      return (...args: unknown[]) => {
        if (metodos.has(prop)) op = prop
        if (prop === "maybeSingle" || prop === "single") unico = true
        estado.chamadas.push({ tabela, op: prop, args })
        return b
      }
    },
  })
  return b
}

export const supabase = {
  from: (tabela: string) => consulta(tabela),
  rpc: (nome: string, args?: unknown) => {
    estado.chamadas.push({ tabela: `rpc:${nome}`, op: "rpc", args: [args] })
    return Promise.resolve(estado.respostas[`rpc:${nome}`] ?? { data: null, error: null }).then((r) => (typeof r === "function" ? r(estado.chamadas) : r))
  },
  storage: {
    from: (bucket: string) => ({
      upload: async (caminho: string) => {
        estado.chamadas.push({ tabela: `storage:${bucket}`, op: "upload", args: [caminho] })
        return { data: { path: caminho }, error: null }
      },
      createSignedUrl: async () => ({ data: { signedUrl: "https://exemplo.invalid/arquivo" }, error: null }),
      getPublicUrl: (c: string) => ({ data: { publicUrl: `https://exemplo.invalid/${c}` } }),
    }),
  },
}
export const chamou = (tabela: string, op?: string) => estado.chamadas.filter((c) => c.tabela === tabela && (!op || c.op === op))
