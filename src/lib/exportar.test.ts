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
    expect(await baixarMeusDados()).toMatch(/não conseguimos gerar/i)
    expect(baixados).toHaveLength(0)
  })
})
