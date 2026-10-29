import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js"
import { beforeEach, describe, expect, it, vi } from "vitest"

const invoke = vi.hoisted(() => vi.fn())
const sair = vi.hoisted(() => vi.fn())
vi.mock("./supabase", () => ({ supabase: { functions: { invoke } } }))
vi.mock("./sessao", () => ({ sair }))

import { excluirMinhaConta } from "./excluirConta"

const http = (corpo: unknown, status = 400) => new FunctionsHttpError(Response.json(corpo, { status }))

beforeEach(() => {
  invoke.mockReset()
  sair.mockReset()
})

describe("excluirMinhaConta", () => {
  it("sucesso chama a função com e-mail e senha e encerra a sessão local", async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null })
    expect(await excluirMinhaConta("a@exemplo.test", "senha_falsa")).toBeNull()
    expect(invoke).toHaveBeenCalledWith("excluir-conta", { body: { email: "a@exemplo.test", senha: "senha_falsa" } })
    expect(sair).toHaveBeenCalledTimes(1)
  })

  it.each([
    ["email_diferente", /e-mail digitado/i],
    ["senha_invalida", /senha incorreta/i],
    ["mfa_requerido", /duas etapas/i],
    ["equipe", /equipe/i],
    ["stripe", /nada foi excluído/i],
    ["exclusao", /assinatura foi cancelada/i],
  ])("erro %s vira mensagem própria e não encerra a sessão", async (erro, mensagem) => {
    invoke.mockResolvedValue({ data: null, error: http({ erro }) })
    expect(await excluirMinhaConta("a@exemplo.test", "x")).toMatch(mensagem)
    expect(sair).not.toHaveBeenCalled()
  })

  it("erro desconhecido, corpo ilegível e rede viram mensagem genérica, sem detalhes", async () => {
    for (const e of [http({ erro: "interno", detalhe: "segredo" }, 500), http("não é json", 500), new FunctionsFetchError(new Error("segredo"))]) {
      invoke.mockResolvedValue({ data: null, error: e })
      const m = await excluirMinhaConta("a@exemplo.test", "x")
      expect(m).toMatch(/não conseguimos excluir/i)
      expect(m).not.toMatch(/segredo/)
    }
    expect(sair).not.toHaveBeenCalled()
  })
})
