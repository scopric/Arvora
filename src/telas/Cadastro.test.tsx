import { cleanup, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { renderiza } from "../testeUtil"

vi.mock("../lib/sessao", () => ({ useAuth: () => ({ sessao: null, carregando: false }) }))
vi.mock("../lib/supabase", () => ({ supabase: { auth: { signUp: vi.fn() } } }))

beforeEach(() => vi.resetModules())
afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

async function ver(url: string) {
  const { Cadastro } = await import("./Cadastro")
  renderiza(<Cadastro />, url)
}

describe("Cadastro: links legais", () => {
  it("PT: termos e privacidade apontam para o site (www) em português", async () => {
    vi.stubEnv("VITE_SITE_URL", "https://www.exemplo.invalid")
    vi.stubEnv("VITE_APP_URL", "https://app.exemplo.invalid")
    await ver("/pt/cadastro")
    expect(screen.getByRole("link", { name: "Termos de uso" }).getAttribute("href")).toBe("https://www.exemplo.invalid/pt/termos")
    expect(screen.getByRole("link", { name: "Política de privacidade" }).getAttribute("href")).toBe("https://www.exemplo.invalid/pt/privacidade")
    expect(screen.getByText(/Ao criar a conta, você concorda com os/)).toBeTruthy()
  })

  it("EN: termos e privacidade apontam para o site (www) em inglês", async () => {
    vi.stubEnv("VITE_SITE_URL", "https://www.exemplo.invalid")
    vi.stubEnv("VITE_APP_URL", "https://app.exemplo.invalid")
    await ver("/en/cadastro")
    expect(screen.getByRole("link", { name: "Terms of use" }).getAttribute("href")).toBe("https://www.exemplo.invalid/en/termos")
    expect(screen.getByRole("link", { name: "Privacy policy" }).getAttribute("href")).toBe("https://www.exemplo.invalid/en/privacidade")
    expect(screen.getByText(/By creating an account, you agree to the/)).toBeTruthy()
  })

  it("sem endereços separados (local/prévia): links relativos", async () => {
    await ver("/pt/cadastro")
    expect(screen.getByRole("link", { name: "Termos de uso" }).getAttribute("href")).toBe("/pt/termos")
  })
})
