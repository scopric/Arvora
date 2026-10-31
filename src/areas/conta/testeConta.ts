import axe from "axe-core"

// Só para testes da área. Banco falso encadeável: cada método devolve o próprio objeto, e esperar por ele entrega `valor()`.
export function consulta(valor: () => unknown) {
  const q: Record<string, unknown> = {}
  for (const m of ["select", "eq", "in", "lte", "order", "limit", "insert", "update", "delete"]) q[m] = () => q
  q.maybeSingle = () => Promise.resolve(valor())
  q.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(valor()).then(ok, ko)
  return q
}


// jsdom não calcula layout nem cor: o contraste é medido no Lighthouse, não aqui.
export async function violacoes() {
  const r = await axe.run(document.body, { rules: { "color-contrast": { enabled: false } } })
  return r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target).join(", ")}`)
}
