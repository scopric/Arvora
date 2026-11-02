import { cleanup, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { renderiza } from "../testeUtil"
import { Entrar } from "./Entrar"

const auth = vi.hoisted(() => ({ signInWithPassword: vi.fn(), resend: vi.fn() }))
vi.mock("../lib/sessao", () => ({ useAuth: () => ({ sessao: null, carregando: false }) }))
vi.mock("../lib/supabase", () => ({ supabase: { auth } }))

beforeEach(() => {
  for (const f of Object.values(auth)) f.mockReset()
})
afterEach(cleanup)

async function tentar(code: string) {
  auth.signInWithPassword.mockResolvedValue({ error: { code, message: "x", status: 400 } })
  renderiza(<Entrar />, "/pt/entrar")
  const u = userEvent.setup()
  await u.type(screen.getByLabelText("E-mail"), "ana@exemplo.invalid")
  await u.type(screen.getByLabelText("Senha"), "SenhaForte123")
  await u.click(screen.getByRole("button", { name: "Entrar" }))
  await waitFor(() => expect(auth.signInWithPassword).toHaveBeenCalled())
  return u
}

describe("Entrar: e-mail sem confirmar", () => {
  it("oferece reenviar o link e chama auth.resend com o e-mail tentado", async () => {
    auth.resend.mockResolvedValue({ error: null })
    const u = await tentar("email_not_confirmed")
    await u.click(await screen.findByRole("button", { name: "Reenviar o link de confirmação" }))
    await waitFor(() => expect(auth.resend).toHaveBeenCalledWith({ type: "signup", email: "ana@exemplo.invalid", options: {} }))
    expect(await screen.findByText(/enviamos um novo link/)).toBeTruthy()
  })

  it("outro erro (senha errada) não mostra o botão de reenvio", async () => {
    await tentar("invalid_credentials")
    expect(screen.queryByRole("button", { name: "Reenviar o link de confirmação" })).toBeNull()
  })
})
