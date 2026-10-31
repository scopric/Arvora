import { cleanup, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../../lib/supabase", async () => (await import("./supabaseFalso")).moduloFalso)
vi.mock("../../lib/sessao", async () => (await import("./supabaseFalso")).moduloSessao)

import { FunctionsHttpError } from "@supabase/supabase-js"
import { montar } from "./montar"
import { estado, falso, zerar } from "./supabaseFalso"
import { Planos } from "./telas/Planos"
import { VERSAO_ACEITE } from "./checkout"

const planos = [
  { id: 1, nivel: "clube", intervalo: "mes", valor_centavos: 2700, moeda: "EUR" },
  { id: 2, nivel: "grupo", intervalo: "mes", valor_centavos: 3700, moeda: "EUR" },
  { id: 3, nivel: "grupo", intervalo: "ano", valor_centavos: 35000, moeda: "EUR" },
]
const assign = vi.fn()
beforeEach(() => {
  zerar()
  estado.sessao = null
  assign.mockReset()
  vi.stubGlobal("location", { assign })
  falso.tabelas.planos = { data: planos, error: null }
})
afterEach(cleanup)
const ver = (acesso = {}) => montar(<Planos />, "/:lang/planos", "/pt/planos", acesso)

describe("Planos", () => {
  it("mostra preço do banco e alterna mensal/anual (ciclo sem plano = indisponível)", async () => {
    ver()
    expect(await screen.findByText(/37,00/)).toBeTruthy()
    await userEvent.click(screen.getByRole("radio", { name: "Anual" }))
    expect(screen.getByText(/350,00/)).toBeTruthy()
    expect(screen.getByText("Indisponível neste ciclo")).toBeTruthy()
  })

  it("visitante vai para o cadastro; não chama o checkout", async () => {
    ver()
    const link = await screen.findByRole("link", { name: "Assinar o Clube" })
    expect(link.getAttribute("href")).toBe("/pt/cadastro")
    expect(falso.invoke).not.toHaveBeenCalled()
  })

  it("erro ou lista vazia vira 'Falar com suporte', nunca vitrine vazia", async () => {
    falso.tabelas.planos = { data: null, error: { message: "x" } }
    ver()
    expect(await screen.findByRole("link", { name: "Falar com suporte" })).toBeTruthy()
    cleanup()
    falso.tabelas.planos = { data: [], error: null }
    ver()
    expect(await screen.findByRole("link", { name: "Falar com suporte" })).toBeTruthy()
  })

  it("logado sem plano: exige as duas confirmações e manda aceite.versao ao checkout", async () => {
    estado.sessao = { user: { id: "u1", email: "a@b.invalid" } }
    falso.invoke.mockResolvedValue({ data: { url: "https://checkout.stripe.com/c/x" }, error: null })
    ver()
    await userEvent.click(await screen.findByRole("button", { name: "Assinar o Clube" }))
    await userEvent.click(screen.getByRole("checkbox", { name: /comece imediatamente/ }))
    await userEvent.click(screen.getByRole("button", { name: "Continuar para o pagamento" }))
    expect(await screen.findByText("Marque as duas confirmações para continuar.")).toBeTruthy()
    expect(falso.invoke).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole("checkbox", { name: /perder o direito/ }))
    await userEvent.click(screen.getByRole("button", { name: "Continuar para o pagamento" }))
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://checkout.stripe.com/c/x"))
    expect(falso.invoke).toHaveBeenCalledWith("stripe-checkout", { body: { plano_id: 1, idioma: "pt", aceite: { versao: VERSAO_ACEITE } } })
    expect(VERSAO_ACEITE).toMatch(/^[A-Za-z0-9._-]{1,32}$/)
  })

  it("url fora do Stripe, 429 e 409 viram mensagem, sem redirecionar", async () => {
    estado.sessao = { user: { id: "u1", email: "a@b.invalid" } }
    const abrir = async () => {
      await userEvent.click(await screen.findByRole("button", { name: "Assinar o Clube" }))
      await userEvent.click(screen.getByRole("checkbox", { name: /comece imediatamente/ }))
      await userEvent.click(screen.getByRole("checkbox", { name: /perder o direito/ }))
      await userEvent.click(screen.getByRole("button", { name: "Continuar para o pagamento" }))
    }
    ver()
    falso.invoke.mockResolvedValue({ data: { url: "https://malicioso.invalid/x" }, error: null })
    await abrir()
    expect(await screen.findByText(/Não conseguimos abrir o pagamento/)).toBeTruthy()
    falso.invoke.mockResolvedValue({ data: null, error: new FunctionsHttpError(Response.json({}, { status: 429 })) })
    await userEvent.click(screen.getByRole("button", { name: "Continuar para o pagamento" }))
    expect(await screen.findByText(/Muitas tentativas/)).toBeTruthy()
    falso.invoke.mockResolvedValue({ data: null, error: new FunctionsHttpError(Response.json({}, { status: 409 })) })
    await userEvent.click(screen.getByRole("button", { name: "Continuar para o pagamento" }))
    expect(await screen.findByText(/Você já tem uma assinatura/)).toBeTruthy()
    expect(assign).not.toHaveBeenCalled()
  })

  it("logado já no Clube: 'Seu plano atual' no Clube e troca pelo perfil no Grupo; erro de acesso não vira 'sem plano'", async () => {
    estado.sessao = { user: { id: "u1", email: "a@b.invalid" } }
    ver({ nivel: "clube" })
    expect(await screen.findByText("Seu plano atual")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Assinar o Grupo Árvora" })).toBeNull()
    cleanup()
    ver({ erro: true })
    expect((await screen.findAllByText("Não conseguimos conferir o seu acesso agora.")).length).toBeGreaterThan(0)
    expect(screen.queryByRole("button", { name: /Assinar/ })).toBeNull()
  })
})
