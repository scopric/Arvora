import { cleanup, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AcessoContext } from "../../../lib/acesso"
import { renderiza } from "../../../testeUtil"
import { violacoes } from "../testeConta"

const auth = vi.hoisted(() => ({
  updateUser: vi.fn(),
  reauthenticate: vi.fn(),
  mfa: { listFactors: vi.fn(), enroll: vi.fn(), challengeAndVerify: vi.fn(), unenroll: vi.fn() },
}))
vi.mock("../../../lib/supabase", () => ({ supabase: { auth } }))
vi.mock("../../../lib/sessao", () => ({
  useAuth: () => ({ sessao: { user: { id: "u1", email: "ana@exemplo.invalid" } }, carregando: false }),
  sair: vi.fn(),
}))

import { Configuracoes } from "./Configuracoes"

const acesso = (equipe: boolean) => ({ carregando: false, erro: false, nivel: "grupo" as const, premiado: false, equipe, papel: null, recarregar: () => {} })
const monta = (equipe = false, url = "/pt") =>
  renderiza(<AcessoContext value={acesso(equipe)}><main><Configuracoes /></main></AcessoContext>, url)

beforeEach(() => {
  for (const f of [auth.updateUser, auth.reauthenticate, ...Object.values(auth.mfa)]) f.mockReset()
  auth.updateUser.mockResolvedValue({ error: null })
  auth.reauthenticate.mockResolvedValue({ error: null })
  auth.mfa.listFactors.mockResolvedValue({ data: { totp: [], all: [] }, error: null })
})
afterEach(cleanup)

describe("tela Configurações: e-mail", () => {
  it("e-mail inválido ou igual ao atual não chama o Supabase", async () => {
    monta()
    await userEvent.type(screen.getByLabelText("Novo e-mail"), "isso-nao-e-email")
    await userEvent.click(screen.getByRole("button", { name: "Trocar e-mail" }))
    expect((await screen.findByRole("alert")).textContent).toMatch(/e-?mail/i)
    await userEvent.clear(screen.getByLabelText("Novo e-mail"))
    await userEvent.type(screen.getByLabelText("Novo e-mail"), "ANA@exemplo.invalid")
    await userEvent.click(screen.getByRole("button", { name: "Trocar e-mail" }))
    expect((await screen.findByRole("alert")).textContent).toMatch(/já é o seu e-mail atual/i)
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  it("troca válida avisa que falta confirmar", async () => {
    monta()
    await userEvent.type(screen.getByLabelText("Novo e-mail"), "nova@exemplo.invalid")
    await userEvent.click(screen.getByRole("button", { name: "Trocar e-mail" }))
    expect((await screen.findByRole("status")).textContent).toMatch(/só vale depois de confirmar/i)
    expect(auth.updateUser).toHaveBeenCalledWith({ email: "nova@exemplo.invalid" })
  })

  it("erro do Supabase aparece na tela", async () => {
    auth.updateUser.mockResolvedValue({ error: { code: "over_email_send_rate_limit" } })
    monta()
    await userEvent.type(screen.getByLabelText("Novo e-mail"), "nova@exemplo.invalid")
    await userEvent.click(screen.getByRole("button", { name: "Trocar e-mail" }))
    expect((await screen.findByRole("alert")).textContent).toMatch(/muitos pedidos/i)
  })
})

describe("tela Configurações: senha", () => {
  it("senha fraca é barrada antes de chamar o Supabase", async () => {
    monta()
    await userEvent.type(screen.getByLabelText("Nova senha"), "curta")
    await userEvent.click(screen.getByRole("button", { name: "Trocar senha" }))
    expect((await screen.findByRole("alert")).textContent).toMatch(/8 caracteres/i)
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  it("reautenticação ligada: pede o código por e-mail e repete a troca com o nonce", async () => {
    auth.updateUser.mockResolvedValueOnce({ error: { code: "reauthentication_needed" } })
    monta()
    await userEvent.type(screen.getByLabelText("Nova senha"), "Senha-nova-123")
    await userEvent.click(screen.getByRole("button", { name: "Trocar senha" }))
    await userEvent.type(await screen.findByLabelText("Código recebido por e-mail"), "123456")
    expect(auth.reauthenticate).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole("button", { name: "Trocar senha" }))
    await waitFor(() => expect(auth.updateUser).toHaveBeenLastCalledWith({ password: "Senha-nova-123", nonce: "123456" }))
    expect((await screen.findByText("Senha alterada.")).getAttribute("role")).toBe("status")
    expect(screen.queryByLabelText("Código recebido por e-mail")).toBeNull()
  })

  it("código errado mostra a mensagem e mantém o campo", async () => {
    auth.updateUser.mockResolvedValueOnce({ error: { code: "reauthentication_needed" } }).mockResolvedValueOnce({ error: { code: "reauthentication_not_valid" } })
    monta()
    await userEvent.type(screen.getByLabelText("Nova senha"), "Senha-nova-123")
    await userEvent.click(screen.getByRole("button", { name: "Trocar senha" }))
    await userEvent.type(await screen.findByLabelText("Código recebido por e-mail"), "000000")
    await userEvent.click(screen.getByRole("button", { name: "Trocar senha" }))
    expect((await screen.findByRole("alert")).textContent).toMatch(/código incorreto/i)
    expect(screen.getByLabelText("Código recebido por e-mail")).toBeTruthy()
  })
})

describe("tela Configurações: 2FA da equipe", () => {
  it("membro comum não vê o bloco", () => {
    monta(false)
    expect(screen.queryByText("Verificação em duas etapas")).toBeNull()
    expect(auth.mfa.listFactors).not.toHaveBeenCalled()
  })

  it("equipe sem fator: cadastrar mostra o QR; o código confirma o fator", async () => {
    auth.mfa.enroll.mockResolvedValue({ data: { id: "f1", totp: { qr_code: "data:image/svg+xml;utf8,<svg/>", secret: "ABCDEF" } }, error: null })
    auth.mfa.challengeAndVerify.mockResolvedValue({ error: null })
    monta(true)
    await userEvent.click(await screen.findByRole("button", { name: "Cadastrar aplicativo" }))
    expect(await screen.findByText("ABCDEF")).toBeTruthy()
    auth.mfa.listFactors.mockResolvedValue({ data: { totp: [{ id: "f1" }], all: [] }, error: null })
    await userEvent.type(screen.getByLabelText("Código de 6 dígitos"), "123456")
    await userEvent.click(screen.getByRole("button", { name: "Verificar" }))
    expect(await screen.findByText(/Ativada/)).toBeTruthy()
    expect(auth.mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: "f1", code: "123456" })
  })

  it("remover exige o código atual: verifica e só então desvincula", async () => {
    auth.mfa.listFactors.mockResolvedValue({ data: { totp: [{ id: "f9" }], all: [] }, error: null })
    auth.mfa.challengeAndVerify.mockResolvedValue({ error: null })
    auth.mfa.unenroll.mockResolvedValue({ error: null })
    monta(true)
    await userEvent.click(await screen.findByRole("button", { name: "Remover verificação" }))
    auth.mfa.listFactors.mockResolvedValue({ data: { totp: [], all: [] }, error: null })
    await userEvent.type(screen.getByLabelText("Código de 6 dígitos"), "654321")
    await userEvent.click(screen.getByRole("button", { name: "Remover agora" }))
    expect(await screen.findByText(/Não cadastrada/)).toBeTruthy()
    expect(auth.mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: "f9", code: "654321" })
    expect(auth.mfa.unenroll).toHaveBeenCalledWith({ factorId: "f9" })
  })

  it("código errado na remoção não desvincula", async () => {
    auth.mfa.listFactors.mockResolvedValue({ data: { totp: [{ id: "f9" }], all: [] }, error: null })
    auth.mfa.challengeAndVerify.mockResolvedValue({ error: { code: "mfa_verification_failed" } })
    monta(true)
    await userEvent.click(await screen.findByRole("button", { name: "Remover verificação" }))
    await userEvent.type(screen.getByLabelText("Código de 6 dígitos"), "000000")
    await userEvent.click(screen.getByRole("button", { name: "Remover agora" }))
    expect((await screen.findAllByRole("alert")).some((a) => /código incorreto/i.test(a.textContent ?? ""))).toBe(true)
    expect(auth.mfa.unenroll).not.toHaveBeenCalled()
  })

  it.each([["/pt", false], ["/en", true]] as const)("sem violações de acessibilidade (axe) em %s (equipe: %s)", async (url, equipe) => {
    monta(equipe, url)
    if (equipe) await screen.findByRole("button", { name: /Set up an app/ })
    expect(await violacoes()).toEqual([])
  })
})
