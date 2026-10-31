import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const rpc = vi.hoisted(() => vi.fn())
vi.mock("./supabase", () => ({ supabase: { rpc } }))

import { baixarMeusDados } from "./exportar"

let blobs: Blob[]
let baixados: string[]

beforeEach(() => {
  blobs = []
  baixados = []
  URL.createObjectURL = vi.fn((b: Blob) => (blobs.push(b), "blob:teste"))
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    baixados.push(this.download)
  })
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("baixarMeusDados", () => {
  it("sucesso: baixa o JSON com o conteúdo, nome com a data local, e libera a URL", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] })
    rpc.mockResolvedValue({ data: { versao: 1, conta: { email: "a@exemplo.test" } }, error: null })
    expect(await baixarMeusDados()).toBeNull()
    expect(rpc).toHaveBeenCalledWith("exportar_meus_dados")
    expect(baixados).toHaveLength(1)
    expect(baixados[0]).toMatch(/^arvora-meus-dados-\d{4}-\d{2}-\d{2}\.json$/)
    expect(JSON.parse(await blobs[0].text())).toEqual({ versao: 1, conta: { email: "a@exemplo.test" } })
    // A URL só é liberada depois de um atraso (revogar na hora cancela o download em alguns navegadores).
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:teste")
  })

  it("erro do banco: devolve mensagem e não baixa nada", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } })
    expect(await baixarMeusDados()).toBe("perfil.dados.erro")
    expect(baixados).toHaveLength(0)
  })

  it("sub inválido (banco levanta nao_autenticado): devolve mensagem e não baixa nada", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "nao_autenticado", code: "P0001" } })
    expect(await baixarMeusDados()).toBe("perfil.dados.erro")
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(baixados).toHaveLength(0)
  })

  it("assinatura órfã (perfil e equipe nulos, lista de assinaturas vazia): exporta como veio", async () => {
    const orfa = { versao: 1, conta: { id: "u1" }, perfil: null, equipe: null, assinaturas: [], clientes_stripe: [] }
    rpc.mockResolvedValue({ data: orfa, error: null })
    expect(await baixarMeusDados()).toBeNull()
    expect(JSON.parse(await blobs[0].text())).toEqual(orfa)
  })
})
