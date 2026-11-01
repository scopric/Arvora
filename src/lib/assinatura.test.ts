import { beforeEach, describe, expect, it, vi } from "vitest"

const invoke = vi.hoisted(() => vi.fn())
vi.mock("./supabase", () => ({ supabase: { functions: { invoke } } }))

import { FunctionsHttpError } from "@supabase/supabase-js"
import { abrirPortal } from "./assinatura"

const assign = vi.fn()
beforeEach(() => {
  invoke.mockReset()
  assign.mockReset()
  vi.stubGlobal("location", { assign })
})

describe("assinatura", () => {
  it("segue só para url https", async () => {
    invoke.mockResolvedValue({ data: { url: "https://billing.stripe.com/p/x" }, error: null })
    expect(await abrirPortal("pt")).toBeNull()
    expect(assign).toHaveBeenCalledWith("https://billing.stripe.com/p/x")
  })

  it("url não-https, host fora do Stripe ou erro vira mensagem, sem redirecionar", async () => {
    const urls = ["javascript:alert(1)", "http://checkout.stripe.com/c/x", "https://checkout.stripe.com.malicioso.exemplo/x",
      "https://malicioso.exemplo/?checkout.stripe.com", "https://stripe.com/x", "https://checkout.stripe.com/c/x", "não é url"]
    for (const r of [...urls.map((url) => ({ data: { url }, error: null })), { data: null, error: new Error("x") }]) {
      invoke.mockResolvedValue(r)
      expect(await abrirPortal("pt")).toBe("perfil.assinatura.erroPortal")
    }
    expect(assign).not.toHaveBeenCalled()
  })

  it("429 (limite de chamadas) vira mensagem própria", async () => {
    const erro = new FunctionsHttpError(Response.json({ erro: "limite" }, { status: 429 }))
    invoke.mockResolvedValue({ data: null, error: erro })
    expect(await abrirPortal("pt")).toBe("perfil.assinatura.erroLimite")
    expect(assign).not.toHaveBeenCalled()
    const outro = new FunctionsHttpError(Response.json({ erro: "x" }, { status: 500 }))
    invoke.mockResolvedValue({ data: null, error: outro })
    expect(await abrirPortal("pt")).toBe("perfil.assinatura.erroPortal")
  })
})
