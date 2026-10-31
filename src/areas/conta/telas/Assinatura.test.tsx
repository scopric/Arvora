import { cleanup, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { renderiza } from "../../../testeUtil"
import { violacoes } from "../testeConta"

const resp = vi.hoisted(() => ({ assinaturas: {} as unknown }))
vi.mock("../../../lib/supabase", async () => {
  const { consulta } = await import("../testeConta")
  return { supabase: { from: () => ({ select: () => consulta(() => resp.assinaturas) }) } }
})
vi.mock("../../../lib/sessao", () => ({
  useAuth: () => ({ sessao: { user: { id: "u1", email: "ana@exemplo.invalid" } }, carregando: false }),
  sair: vi.fn(),
}))
const abrirPortal = vi.hoisted(() => vi.fn())
vi.mock("../../../lib/assinatura", () => ({ abrirPortal }))

import { Assinatura } from "./Assinatura"

const plano = { nome: "Grupo", intervalo: "mes", valor_centavos: 4900, moeda: "EUR" }
// stripe_criada_em bem antigo: o prazo de 14 dias já passou, a menos que o teste diga o contrário.
const linha = (extra: object = {}) => ({
  status: "active", origem: "stripe", cancela_no_fim: false, periodo_fim: "2026-12-15T10:00:00Z",
  stripe_criada_em: "2025-01-01T10:00:00Z", criado_em: "2025-01-01T10:00:00Z", planos: plano, ...extra,
})
const monta = (url = "/pt") => renderiza(<main><Assinatura /></main>, url)

beforeEach(() => {
  resp.assinaturas = { data: [linha()], error: null }
  abrirPortal.mockReset()
  abrirPortal.mockResolvedValue(null)
})
afterEach(cleanup)

describe("tela Assinatura", () => {
  it("ativa: plano, valor e próxima cobrança", async () => {
    monta()
    expect(await screen.findByRole("heading", { name: "Grupo" })).toBeTruthy()
    expect(screen.getByText("Ativa")).toBeTruthy()
    expect(screen.getByText(/49,00/)).toBeTruthy()
    expect(screen.getByText("Próxima cobrança:")).toBeTruthy()
    expect(screen.getByText("15/12/2026")).toBeTruthy()
  })

  it("pagamento pendente (past_due) explica a tolerância de 7 dias", async () => {
    resp.assinaturas = { data: [linha({ status: "past_due" })], error: null }
    monta()
    expect(await screen.findAllByText("Pagamento pendente")).toHaveLength(1)
    expect(screen.getByRole("alert").textContent).toMatch(/7 dias/)
  })

  it("cancelada e ativa até a data do fim do período", async () => {
    resp.assinaturas = { data: [linha({ cancela_no_fim: true })], error: null }
    monta()
    expect(await screen.findByText("Cancelada, ativa até:")).toBeTruthy()
    expect(screen.getByText("Cancelada")).toBeTruthy()
    expect(screen.queryByText("Próxima cobrança:")).toBeNull()
  })

  it("vigente vence a encerrada mais nova; só encerrada mostra 'Encerrada em'", async () => {
    resp.assinaturas = { data: [linha({ status: "canceled", periodo_fim: "2027-01-01T10:00:00Z" }), linha()], error: null }
    monta()
    expect(await screen.findByText("Ativa")).toBeTruthy()
    cleanup()
    resp.assinaturas = { data: [linha({ status: "canceled" })], error: null }
    monta()
    expect(await screen.findByText("Encerrada em:")).toBeTruthy()
  })

  it("sem assinatura: convite para ver planos, e o direito de cancelar continua explicado", async () => {
    resp.assinaturas = { data: [], error: null }
    monta()
    expect((await screen.findByRole("link", { name: "Ver planos" })).getAttribute("href")).toBe("/pt/planos")
    expect(screen.getByRole("heading", { name: "Seu direito de cancelar em 14 dias" })).toBeTruthy()
  })

  it("falha de leitura aparece como erro, não como 'sem assinatura'", async () => {
    resp.assinaturas = { data: null, error: { message: "boom" } }
    monta()
    expect((await screen.findByRole("alert")).textContent).toMatch(/não conseguimos carregar/i)
    expect(screen.queryByText(/ainda não tem uma assinatura/i)).toBeNull()
  })

  it("prazo de 14 dias: aberto mostra a data final; vencido avisa", async () => {
    const agora = new Date().toISOString()
    resp.assinaturas = { data: [linha({ stripe_criada_em: agora })], error: null }
    monta()
    expect(await screen.findByText(/termina em/)).toBeTruthy()
    cleanup()
    resp.assinaturas = { data: [linha()], error: null }
    monta()
    expect(await screen.findByText(/já terminou/)).toBeTruthy()
  })

  it("Gerenciar no Stripe abre o portal e mostra o erro devolvido; acesso manual não tem o botão", async () => {
    abrirPortal.mockResolvedValue("perfil.assinatura.erroPortal")
    monta("/en")
    await userEvent.click(await screen.findByRole("button", { name: "Manage in Stripe" }))
    expect(abrirPortal).toHaveBeenCalledWith("en")
    expect((await screen.findByRole("alert")).textContent).toMatch(/payment page/i)
    cleanup()
    resp.assinaturas = { data: [linha({ origem: "manual" })], error: null }
    monta()
    await screen.findByText("Acesso concedido pela equipe até:")
    expect(screen.queryByRole("button", { name: /Stripe/ })).toBeNull()
  })

  it.each(["/pt", "/en"])("sem violações de acessibilidade (axe) em %s", async (url) => {
    resp.assinaturas = { data: [linha({ status: "past_due" })], error: null }
    monta(url)
    await screen.findByRole("link", { name: /suporte|support/i })
    expect(await violacoes()).toEqual([])
  })
})
