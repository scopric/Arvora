import { describe, expect, it, vi } from "vitest"

const falso = vi.hoisted(() => ({ atual: {} as unknown }))
vi.mock("../../lib/supabase", () => ({
  supabase: new Proxy({}, { get: (_, k) => (falso.atual as Record<string | symbol, unknown>)[k] }),
}))

import { carregarCurso } from "./curso"
import { criarFalso } from "./testeSupabase"

describe("carregarCurso", () => {
  it("sequência do curso é módulo, depois aula (o `ordem` recomeça em cada módulo)", async () => {
    const aula = (id: number, modulo_id: number, ordem: number) => ({ id, slug: `a${id}`, modulo_id, ordem })
    falso.atual = criarFalso({
      "cursos.single": { data: { id: 1, slug: "c" }, error: null },
      modulos: { data: [{ id: 10, titulo: "M1", ordem: 1 }, { id: 20, titulo: "M2", ordem: 2 }], error: null },
      // como o banco devolve com order("ordem"): M1/1, M2/1, M1/2
      aulas: { data: [aula(1, 10, 1), aula(3, 20, 1), aula(2, 10, 2)], error: null },
      progresso_aula: { data: [], error: null },
    })
    const r = await carregarCurso("c", "u1")
    expect(r?.aulas.map((a) => a.id)).toEqual([1, 2, 3])
  })
})
