import { beforeEach, describe, expect, it, vi } from "vitest"

const invoke = vi.hoisted(() => vi.fn())
vi.mock("./supabase", () => ({ supabase: { functions: { invoke } } }))

import { abrirPortal, iniciarCheckout } from "./assinatura"

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
    invoke.mockResolvedValue({ data: { url: "https://checkout.stripe.com/c/x" }, error: null })
    expect(await iniciarCheckout(7, "en")).toBeNull()
    expect(invoke).toHaveBeenCalledWith("stripe-checkout", { body: { plano_id: 7, idioma: "en" } })
    expect(assign).toHaveBeenCalledWith("https://checkout.stripe.com/c/x")
  })

  it("url não-https, host fora do Stripe ou erro vira mensagem, sem redirecionar", async () => {
    const urls = ["javascript:alert(1)", "http://checkout.stripe.com/c/x", "https://checkout.stripe.com.malicioso.exemplo/x",
      "https://malicioso.exemplo/?checkout.stripe.com", "https://stripe.com/x", "não é url"]
    for (const r of [...urls.map((url) => ({ data: { url }, error: null })), { data: null, error: new Error("x") }]) {
      invoke.mockResolvedValue(r)
      expect(await abrirPortal("pt")).toBe("perfil.assinatura.erroPortal")
    }
    expect(assign).not.toHaveBeenCalled()
  })
})
