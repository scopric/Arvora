import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const verifyOtp = vi.hoisted(() => vi.fn())
vi.mock("../lib/supabase", () => ({ supabase: { auth: { verifyOtp } } }))

import { supabase } from "../lib/supabase"
import { Confirmar } from "./Confirmar"

function abrir(busca: string) {
  render(
    <MemoryRouter initialEntries={[`/pt/confirmar${busca}`]}>
      <Routes>
        <Route path="/:lang/confirmar" element={<Confirmar />} />
        <Route path="/:lang/perfil" element={<p>tela perfil</p>} />
        <Route path="/:lang/redefinir-senha" element={<p>tela redefinir</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(cleanup)
beforeEach(() => verifyOtp.mockReset())

describe("tela Confirmar", () => {
  it("signup: só consome o código no clique e leva ao perfil", async () => {
    verifyOtp.mockResolvedValue({ data: { session: {} }, error: null })
    abrir("?token_hash=abc&type=signup")
    expect(verifyOtp).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }))
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "abc", type: "signup" })
    expect(await screen.findByText("tela perfil")).toBeTruthy()
  })

  it("recovery: leva à tela de nova senha", async () => {
    verifyOtp.mockResolvedValue({ data: { session: {} }, error: null })
    abrir("?token_hash=abc&type=recovery")
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }))
    expect(await screen.findByText("tela redefinir")).toBeTruthy()
  })

  it("token ausente ou tipo desconhecido: link inválido, sem chamar o servidor", () => {
    abrir("?type=signup")
    expect(screen.getByRole("heading", { name: "Link inválido" })).toBeTruthy()
    cleanup()
    abrir("?token_hash=abc&type=magiclink")
    expect(screen.getByRole("heading", { name: "Link inválido" })).toBeTruthy()
    expect(verifyOtp).not.toHaveBeenCalled()
  })

  it("erro do verifyOtp aparece na tela e não navega", async () => {
    verifyOtp.mockResolvedValue({ error: { code: "otp_expired", message: "x" } })
    abrir("?token_hash=abc&type=signup")
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }))
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/expirou/i))
    expect(screen.queryByText("tela perfil")).toBeNull()
  })

  it("troca de e-mail, 1º link (sem sessão): avisa que falta o outro endereço e não navega", async () => {
    verifyOtp.mockResolvedValue({ data: { session: null, user: null }, error: null })
    abrir("?token_hash=abc&type=email_change")
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }))
    expect(await screen.findByRole("heading", { name: "Confirmação registrada" })).toBeTruthy()
    expect(screen.getByRole("status").textContent).toMatch(/outro endereço/i)
    expect(screen.queryByText("tela perfil")).toBeNull()
  })

  it("troca de e-mail, 2º link (com sessão): leva ao perfil", async () => {
    verifyOtp.mockResolvedValue({ data: { session: {} }, error: null })
    abrir("?token_hash=abc&type=email_change")
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }))
    expect(await screen.findByText("tela perfil")).toBeTruthy()
  })

  it("exceção no verifyOtp: erro visível e botão liberado, sem travar em 'Aguarde'", async () => {
    // Função comum (não vi.fn): o vitest 5 marca como falho o teste cujo mock lança, mesmo com o erro tratado.
    const auth = supabase.auth as unknown as { verifyOtp: () => unknown }
    const original = auth.verifyOtp
    auth.verifyOtp = () => Promise.reject(new Error("rede"))
    try {
      abrir("?token_hash=abc&type=signup")
      await userEvent.click(screen.getByRole("button", { name: "Confirmar" }))
      await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/algo deu errado/i))
      expect((screen.getByRole("button", { name: "Confirmar" }) as HTMLButtonElement).disabled).toBe(false)
    } finally {
      auth.verifyOtp = original
    }
  })

  it("clique duplo: um só verifyOtp enquanto o primeiro não volta", async () => {
    let volta: (v: unknown) => void = () => {}
    verifyOtp.mockReturnValue(new Promise((r) => (volta = r)))
    abrir("?token_hash=abc&type=signup")
    const botao = screen.getByRole("button", { name: "Confirmar" })
    await userEvent.click(botao)
    await userEvent.click(botao)
    expect(verifyOtp).toHaveBeenCalledTimes(1)
    volta({ data: { session: {} }, error: null })
    expect(await screen.findByText("tela perfil")).toBeTruthy()
  })
})
