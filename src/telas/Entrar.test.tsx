import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { renderiza } from "../testeUtil"
import { Entrar } from "./Entrar"

const auth = vi.hoisted(() => ({ signInWithPassword: vi.fn(), resend: vi.fn(), signInWithOAuth: vi.fn() }))
const estado = vi.hoisted(() => ({ sessao: null as object | null }))
vi.mock("../lib/sessao", () => ({ useAuth: () => ({ sessao: estado.sessao, carregando: false }) }))
vi.mock("../lib/supabase", () => ({ supabase: { auth } }))

beforeEach(() => {
  estado.sessao = null
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

describe("Entrar: destino", () => {
  it("com sessão e sem ?de, leva ao início (área do membro), não ao perfil", async () => {
    estado.sessao = {}
    render(
      <MemoryRouter initialEntries={["/pt/entrar"]}>
        <Routes>
          <Route path="/:lang/entrar" element={<Entrar />} />
          <Route path="/:lang/inicio" element={<p>tela inicio</p>} />
        </Routes>
      </MemoryRouter>,
    )
    expect(await screen.findByText("tela inicio")).toBeTruthy()
  })
})

describe("Entrar: Google", () => {
  it("chama o OAuth do Google voltando para /entrar com o destino", async () => {
    auth.signInWithOAuth.mockResolvedValue({ error: null })
    renderiza(<Entrar />, "/pt/entrar?de=/pt/aulas")
    await userEvent.click(screen.getByRole("button", { name: "Continuar com o Google" }))
    const volta = new URL(auth.signInWithOAuth.mock.calls[0][0].options.redirectTo)
    expect(auth.signInWithOAuth.mock.calls[0][0].provider).toBe("google")
    expect(volta.pathname).toBe("/pt/entrar")
    expect(volta.searchParams.get("de")).toBe("/pt/aulas")
  })

  it("volta do Google com ?code= sem sessão (troca falhou) mostra o aviso", async () => {
    renderiza(<Entrar />, "/pt/entrar?code=abc")
    expect(await screen.findByText(/Não foi possível entrar com o Google/)).toBeTruthy()
  })

  it("volta do Google com ?error= mostra o aviso", async () => {
    renderiza(<Entrar />, "/pt/entrar?error=access_denied")
    expect(await screen.findByText(/Não foi possível entrar com o Google/)).toBeTruthy()
  })
})
