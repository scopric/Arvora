import { act, cleanup, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../../lib/supabase", async () => (await import("./supabaseFalso")).moduloFalso)
vi.mock("../../lib/sessao", async () => (await import("./supabaseFalso")).moduloSessao)

import { montar } from "./montar"
import { estado, zerar } from "./supabaseFalso"
import { CheckoutSucesso } from "./telas/CheckoutSucesso"

beforeEach(() => {
  zerar()
  vi.useFakeTimers()
  estado.sessao = { user: { id: "u1", email: "a@b.invalid" } }
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})
const ver = (acesso = {}, recarregar = vi.fn()) => (montar(<CheckoutSucesso />, "/:lang/checkout/sucesso", "/pt/checkout/sucesso", { recarregar, ...acesso }), recarregar)

describe("CheckoutSucesso", () => {
  it("consulta o acesso a cada 3 s e, passados 30 s, avisa que pode levar alguns minutos", async () => {
    const recarregar = ver()
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Confirmando sua assinatura")
    expect(screen.getByText("Estamos confirmando seu pagamento.")).toBeTruthy()
    await act(() => vi.advanceTimersByTimeAsync(9000))
    expect(recarregar).toHaveBeenCalledTimes(3)
    await act(() => vi.advanceTimersByTimeAsync(21_000))
    expect(screen.getByText(/Pode levar alguns minutos/)).toBeTruthy()
    expect(screen.queryByText(/e-mail/)).toBeNull()
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Confirmando sua assinatura")
    const antes = recarregar.mock.calls.length
    await act(() => vi.advanceTimersByTimeAsync(10_000))
    expect(recarregar.mock.calls.length).toBe(antes)
  })

  it("com acesso liberado mostra Começar para /bem-vindo e para de consultar", async () => {
    const recarregar = ver({ nivel: "clube" })
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Assinatura confirmada")
    expect(screen.getByRole("link", { name: "Começar" }).getAttribute("href")).toBe("/pt/bem-vindo")
    await act(() => vi.advanceTimersByTimeAsync(10_000))
    expect(recarregar).not.toHaveBeenCalled()
  })

  it("erro de leitura do acesso não vira 'confirmando'", () => {
    ver({ erro: true })
    expect(screen.getByRole("alert")).toBeTruthy()
    expect(screen.queryByText("Estamos confirmando seu pagamento.")).toBeNull()
  })

  it("sem sessão pede para entrar", () => {
    estado.sessao = null
    ver()
    expect(screen.getByRole("link", { name: "Entrar" })).toBeTruthy()
  })
})
