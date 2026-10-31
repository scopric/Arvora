import { cleanup } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { renderiza } from "../testeUtil"

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  vi.resetModules()
  delete window.turnstile
})

async function montar(onToken: (t: string | null) => void) {
  const { Turnstile } = await import("./Turnstile")
  return renderiza(<Turnstile onToken={onToken} />)
}

describe("Turnstile", () => {
  it("sem VITE_TURNSTILE_SITE_KEY não renderiza nada nem carrega o script", async () => {
    const { container } = await montar(vi.fn())
    expect(container.firstChild).toBeNull()
    expect(document.querySelector("script[src*='challenges.cloudflare.com']")).toBeNull()
  })

  it("com a chave, renderiza o widget e repassa o token (e null quando vence)", async () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "chave-publica-de-teste")
    const opcoes: Record<string, (t?: string) => void>[] = []
    window.turnstile = { render: vi.fn((_el, o) => (opcoes.push(o), "w1")), remove: vi.fn() }
    const onToken = vi.fn()
    const { unmount } = await montar(onToken)
    await vi.waitFor(() => expect(opcoes).toHaveLength(1))
    expect((window.turnstile!.render as ReturnType<typeof vi.fn>).mock.calls[0][1].sitekey).toBe("chave-publica-de-teste")
    opcoes[0].callback("tok123")
    expect(onToken).toHaveBeenLastCalledWith("tok123")
    opcoes[0]["expired-callback"]()
    expect(onToken).toHaveBeenLastCalledWith(null)
    unmount()
    expect(window.turnstile!.remove).toHaveBeenCalledWith("w1")
  })
})
