import { cleanup, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { renderiza } from "../testeUtil"

const auth = vi.hoisted(() => ({ signInWithPassword: vi.fn(), signUp: vi.fn(), resetPasswordForEmail: vi.fn() }))
vi.mock("../lib/sessao", () => ({ useAuth: () => ({ sessao: null, carregando: false }) }))
vi.mock("../lib/supabase", () => ({ supabase: { auth } }))
// O widget real fala com a Cloudflare: aqui um botão entrega o token.
vi.mock("../componentes/Turnstile", () => ({
  Turnstile: ({ onToken }: { onToken: (t: string) => void }) => <button type="button" onClick={() => onToken("tok-1")}>resolver captcha</button>,
}))

beforeEach(() => {
  vi.resetModules()
  for (const f of Object.values(auth)) f.mockReset()
})
afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

async function entrar() {
  const { Entrar } = await import("./Entrar")
  renderiza(<Entrar />, "/pt/entrar")
  const u = userEvent.setup()
  await u.type(screen.getByLabelText("E-mail"), "ana@exemplo.invalid")
  await u.type(screen.getByLabelText("Senha"), "SenhaForte123")
  return u
}

describe("CAPTCHA (Turnstile)", () => {
  it("sem VITE_TURNSTILE_SITE_KEY: o Supabase é chamado sem captchaToken", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null })
    const u = await entrar()
    await u.click(screen.getByRole("button", { name: "Entrar" }))
    await waitFor(() => expect(auth.signInWithPassword).toHaveBeenCalled())
    expect(auth.signInWithPassword.mock.calls[0][0]).toEqual({ email: "ana@exemplo.invalid", password: "SenhaForte123" })
  })

  it("com a chave: bloqueia o envio sem token e depois passa captchaToken ao Supabase", async () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "chave-publica-de-teste")
    auth.signInWithPassword.mockResolvedValue({ error: null })
    const u = await entrar()
    await u.click(screen.getByRole("button", { name: "Entrar" }))
    expect((await screen.findByRole("alert")).textContent).toContain("verificação de segurança")
    expect(auth.signInWithPassword).not.toHaveBeenCalled()
    await u.click(screen.getByRole("button", { name: "resolver captcha" }))
    await u.click(screen.getByRole("button", { name: "Entrar" }))
    await waitFor(() => expect(auth.signInWithPassword).toHaveBeenCalled())
    expect(auth.signInWithPassword.mock.calls[0][0].options).toEqual({ captchaToken: "tok-1" })
  })

  it("recuperar senha e cadastro também mandam o token", async () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "chave-publica-de-teste")
    auth.resetPasswordForEmail.mockResolvedValue({ error: null })
    const { RecuperarSenha } = await import("./RecuperarSenha")
    renderiza(<RecuperarSenha />, "/pt/recuperar-senha")
    const u = userEvent.setup()
    await u.type(screen.getByLabelText("E-mail"), "ana@exemplo.invalid")
    await u.click(screen.getByRole("button", { name: "resolver captcha" }))
    await u.click(screen.getByRole("button", { name: /enviar/i }))
    await waitFor(() => expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("ana@exemplo.invalid", { captchaToken: "tok-1" }))
  })

  it("cadastro: bloqueia sem token e manda captchaToken junto das opções existentes", async () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "chave-publica-de-teste")
    auth.signUp.mockResolvedValue({ error: null })
    const { Cadastro } = await import("./Cadastro")
    renderiza(<Cadastro />, "/pt/cadastro")
    const u = userEvent.setup()
    await u.type(screen.getByLabelText("Nome"), "Ana Exemplo")
    await u.type(screen.getByLabelText("E-mail"), "ana@exemplo.invalid")
    await u.type(screen.getByLabelText("Senha"), "SenhaForte123")
    await u.click(screen.getByRole("checkbox"))
    await u.click(screen.getByRole("button", { name: "Criar conta" }))
    expect((await screen.findByRole("alert")).textContent).toContain("verificação de segurança")
    expect(auth.signUp).not.toHaveBeenCalled()
    await u.click(screen.getByRole("button", { name: "resolver captcha" }))
    await u.click(screen.getByRole("button", { name: "Criar conta" }))
    await waitFor(() => expect(auth.signUp).toHaveBeenCalled())
    const opcoes = auth.signUp.mock.calls[0][0].options
    expect(opcoes.captchaToken).toBe("tok-1")
    expect(opcoes.data.idioma).toBe("pt")
  })
})
