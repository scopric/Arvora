import { cleanup, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AcessoContext } from "../../../lib/acesso"
import { renderiza, simularDialog } from "../../../testeUtil"
import { violacoes } from "../testeConta"

const resp = vi.hoisted(() => ({ pedidos: {} as unknown, insert: {} as unknown }))
const insere = vi.hoisted(() => vi.fn())
vi.mock("../../../lib/supabase", async () => {
  const { consulta } = await import("../testeConta")
  return { supabase: { from: () => ({ select: () => consulta(() => resp.pedidos), insert: (v: unknown) => (insere(v), consulta(() => resp.insert)) }) } }
})
vi.mock("../../../lib/sessao", () => ({
  useAuth: () => ({ sessao: { user: { id: "u1", email: "ana@exemplo.invalid" } }, carregando: false }),
  sair: vi.fn(),
}))
const baixar = vi.hoisted(() => vi.fn())
vi.mock("../../../lib/exportar", () => ({ baixarMeusDados: baixar }))
const excluirMinhaConta = vi.hoisted(() => vi.fn())
vi.mock("../../../lib/excluirConta", () => ({ excluirMinhaConta }))
const navegar = vi.hoisted(() => vi.fn())
vi.mock("react-router", async (original) => ({ ...(await original<typeof import("react-router")>()), useNavigate: () => navegar }))

import { Dados } from "./Dados"

const acesso = (equipe = false) => ({ carregando: false, erro: false, nivel: "grupo" as const, premiado: false, equipe, papel: null, recarregar: () => {} })
const monta = (url = "/pt", equipe = false) =>
  renderiza(<AcessoContext value={acesso(equipe)}><main><Dados /></main></AcessoContext>, url)

simularDialog()
beforeEach(() => {
  resp.pedidos = { data: [], error: null }
  resp.insert = { data: [{ id: 3 }], error: null }
  insere.mockReset()
  baixar.mockReset()
  baixar.mockResolvedValue(null)
  excluirMinhaConta.mockReset()
  navegar.mockReset()
})
afterEach(cleanup)

describe("tela Meus dados", () => {
  it("exportar usa baixarMeusDados e mostra o erro devolvido", async () => {
    baixar.mockResolvedValue("perfil.dados.erro")
    monta()
    await userEvent.click(screen.getByRole("button", { name: "Baixar meus dados (JSON)" }))
    expect((await screen.findByRole("alert")).textContent).toMatch(/não conseguimos gerar/i)
    expect(baixar).toHaveBeenCalledTimes(1)
  })

  it("pedidos: lista com situação e prazo (data do dia, sem escorregar)", async () => {
    resp.pedidos = { data: [{ id: 1, tipo: "exclusao", status: "em_andamento", prazo_em: "2026-11-30", criado_em: "2026-10-30T09:00:00Z" }], error: null }
    monta()
    const tabela = await screen.findByRole("table", { name: "Meus pedidos" })
    expect(tabela.textContent).toMatch(/Exclusão/)
    expect(tabela.textContent).toMatch(/Em andamento/)
    expect(tabela.textContent).toMatch(/30\/11\/2026/)
  })

  it("falha ao listar pedidos aparece como erro, não como lista vazia", async () => {
    resp.pedidos = { data: null, error: { message: "boom" } }
    monta()
    expect((await screen.findAllByRole("alert")).some((a) => /não conseguimos carregar/i.test(a.textContent ?? ""))).toBe(true)
    expect(screen.queryByText(/ainda não fez nenhum pedido/i)).toBeNull()
  })

  it("pedido manual insere só perfil_id e tipo; pedido repetido (23505) avisa", async () => {
    monta()
    await userEvent.click(await screen.findByRole("button", { name: "Pedir exportação" }))
    expect(insere).not.toHaveBeenCalled() // antes de confirmar no diálogo, nada é enviado
    await userEvent.click(screen.getByRole("button", { name: "Enviar pedido", hidden: true }))
    expect(await screen.findByText(/Pedido recebido/)).toBeTruthy()
    expect(insere).toHaveBeenCalledWith({ perfil_id: "u1", tipo: "exportacao" })
    resp.insert = { data: null, error: { code: "23505" } }
    await userEvent.click(screen.getByRole("button", { name: "Pedir exclusão" }))
    await userEvent.click(screen.getByRole("button", { name: "Enviar pedido", hidden: true }))
    expect((await screen.findAllByRole("alert"))[0].textContent).toMatch(/já tem um pedido aberto/i)
  })

  it("INSERT sem confirmação do banco (vazio) vira erro", async () => {
    resp.insert = { data: [], error: null }
    monta()
    await userEvent.click(await screen.findByRole("button", { name: "Pedir exclusão" }))
    await userEvent.click(screen.getByRole("button", { name: "Enviar pedido", hidden: true }))
    expect((await screen.findAllByRole("alert"))[0].textContent).toMatch(/não conseguimos registrar/i)
  })

  it("excluir em duas etapas: o diálogo vem antes; só então e-mail e senha; sucesso volta ao início", async () => {
    excluirMinhaConta.mockResolvedValue(null)
    monta()
    await userEvent.click(await screen.findByRole("button", { name: "Quero excluir minha conta" }))
    expect(screen.queryByLabelText("Sua senha")).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "Continuar", hidden: true }))
    expect(document.activeElement).toBe(await screen.findByLabelText("Digite o e-mail da sua conta"))
    await userEvent.type(await screen.findByLabelText("Digite o e-mail da sua conta"), "ana@exemplo.invalid")
    await userEvent.type(screen.getByLabelText("Sua senha"), "segredo")
    await userEvent.click(screen.getByRole("button", { name: "Excluir definitivamente" }))
    await waitFor(() => expect(excluirMinhaConta).toHaveBeenCalledWith("ana@exemplo.invalid", "segredo"))
    expect(navegar).toHaveBeenCalledWith("/pt", { replace: true })
  })

  it("erro da exclusão (menos de 14 dias) aparece e não navega", async () => {
    excluirMinhaConta.mockResolvedValue("erro.excluir.arrependimento")
    monta()
    await userEvent.click(await screen.findByRole("button", { name: "Quero excluir minha conta" }))
    await userEvent.click(screen.getByRole("button", { name: "Continuar", hidden: true }))
    await userEvent.type(await screen.findByLabelText("Digite o e-mail da sua conta"), "ana@exemplo.invalid")
    await userEvent.type(screen.getByLabelText("Sua senha"), "segredo")
    await userEvent.click(screen.getByRole("button", { name: "Excluir definitivamente" }))
    expect((await screen.findByText(/menos de 14 dias/)).getAttribute("role")).toBe("alert")
    expect(navegar).not.toHaveBeenCalled()
  })

  it("equipe não vê o botão de excluir, só o aviso", async () => {
    monta("/pt", true)
    expect((await screen.findAllByText(/papel na equipe/)).length).toBeGreaterThan(0)
    expect(screen.queryByRole("button", { name: "Quero excluir minha conta" })).toBeNull()
  })

  it.each(["/pt", "/en"])("sem violações de acessibilidade (axe) em %s", async (url) => {
    resp.pedidos = { data: [{ id: 1, tipo: "exportacao", status: "recebido", prazo_em: "2026-11-30", criado_em: "2026-10-30T09:00:00Z" }], error: null }
    monta(url)
    await screen.findByRole("table")
    expect(await violacoes()).toEqual([])
  })
})
