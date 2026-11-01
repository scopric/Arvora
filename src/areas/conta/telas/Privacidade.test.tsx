import { cleanup, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { renderiza, simularDialog } from "../../../testeUtil"
import { violacoes } from "../testeConta"

const resp = vi.hoisted(() => ({
  perfil: {} as unknown,
  docs: {} as unknown,
  aceites: {} as unknown,
  perfilUpdate: {} as unknown,
  insert: {} as unknown,
  revoga: {} as unknown,
}))
const chamadas = vi.hoisted(() => ({ insert: vi.fn(), revoga: vi.fn(), perfilUpdate: vi.fn() }))
vi.mock("../../../lib/supabase", async () => {
  const { consulta } = await import("../testeConta")
  return {
    supabase: {
      from: (tabela: string) => {
        if (tabela === "perfis") return { select: () => consulta(() => resp.perfil), update: (v: unknown) => (chamadas.perfilUpdate(v), consulta(() => resp.perfilUpdate)) }
        if (tabela === "documentos_legais") return { select: () => consulta(() => resp.docs) }
        return { select: () => consulta(() => resp.aceites), insert: (v: unknown) => (chamadas.insert(v), consulta(() => resp.insert)), update: (v: unknown) => (chamadas.revoga(v), consulta(() => resp.revoga)) }
      },
    },
  }
})
vi.mock("../../../lib/sessao", () => ({
  useAuth: () => ({ sessao: { user: { id: "u1", email: "ana@exemplo.invalid" } }, carregando: false }),
  sair: vi.fn(),
}))

import { Privacidade } from "./Privacidade"

const docMatch = { id: 7, tipo: "match", idioma: "pt", versao: "v1", titulo: "Autorização do Match", conteudo_md: "Primeiro parágrafo.\n\n<b>não é html</b>" }
const aceiteMatch = { id: 5, aceito_em: "2026-10-30T10:00:00Z", revogado_em: null, documentos_legais: { tipo: "match", versao: "v1", titulo: "Autorização do Match" } }
const aceiteTermos = { id: 6, aceito_em: "2026-10-29T10:00:00Z", revogado_em: null, documentos_legais: { tipo: "termos", versao: "v1", titulo: "Termos de uso" } }
const monta = (url = "/pt") => renderiza(<main><Privacidade /></main>, url)

simularDialog()
beforeEach(() => {
  resp.perfil = { data: { visibilidade: "membros", publico_aprovado_em: null }, error: null }
  resp.docs = { data: [docMatch], error: null }
  resp.aceites = { data: [], error: null }
  resp.perfilUpdate = { data: [{ id: "u1" }], error: null }
  resp.insert = { data: [{ id: 9 }], error: null }
  resp.revoga = { data: [{ id: 5 }], error: null }
  chamadas.insert.mockReset()
  chamadas.revoga.mockReset()
  chamadas.perfilUpdate.mockReset()
})
afterEach(cleanup)

describe("tela Privacidade", () => {
  it("falha ao ler consentimentos aparece como erro, não como lista vazia", async () => {
    resp.aceites = { data: null, error: { message: "boom" } }
    monta()
    expect((await screen.findAllByRole("alert")).some((a) => /não conseguimos carregar/i.test(a.textContent ?? ""))).toBe(true)
    expect(screen.queryByText(/ainda não tem consentimentos/i)).toBeNull()
  })

  it("visibilidade: UPDATE vazio (RLS) vira erro; sucesso avisa da aprovação", async () => {
    resp.perfilUpdate = { data: [], error: null }
    monta()
    await userEvent.click(await screen.findByLabelText(/Também público/))
    await userEvent.click(screen.getByRole("button", { name: "Salvar visibilidade" }))
    expect((await screen.findAllByRole("alert"))[0].textContent).toMatch(/não conseguimos salvar/i)
    expect(screen.queryByText("Alteração salva.")).toBeNull()
    resp.perfilUpdate = { data: [{ id: "u1" }], error: null }
    await userEvent.click(screen.getByRole("button", { name: "Salvar visibilidade" }))
    expect(await screen.findByText("Alteração salva.")).toBeTruthy()
    expect(chamadas.perfilUpdate).toHaveBeenLastCalledWith({ visibilidade: "publico" })
    expect(screen.getByText(/aguarda a aprovação da equipe/i)).toBeTruthy()
  })

  it("Match sem texto vigente: interruptor desligado e travado, com 'em breve'", async () => {
    resp.docs = { data: [], error: null }
    monta()
    const sw = await screen.findByRole("switch", { name: "Participar do Business Match" })
    expect((sw as HTMLInputElement).disabled).toBe(true)
    expect((sw as HTMLInputElement).checked).toBe(false)
    expect(screen.getByText(/Em breve/)).toBeTruthy()
  })

  it("o texto vem antes: o interruptor só destrava depois de abrir o texto, que é mostrado como texto puro", async () => {
    monta()
    const sw = (await screen.findByRole("switch", { name: "Participar do Business Match" })) as HTMLInputElement
    expect(sw.disabled).toBe(true)
    expect(screen.getByText(/Abra e leia o texto/)).toBeTruthy()
    await userEvent.click(screen.getByText(/Ler o texto: Autorização do Match/))
    await waitFor(() => expect(sw.disabled).toBe(false))
    expect(screen.getByText("Primeiro parágrafo.")).toBeTruthy()
    expect(screen.getByText("<b>não é html</b>")).toBeTruthy()
    expect(document.querySelector("details b")).toBeNull()
  })

  it("visibilidade igual à atual não grava nem fala em aprovação", async () => {
    monta()
    await userEvent.click(await screen.findByRole("button", { name: "Salvar visibilidade" }))
    expect(await screen.findByText(/nada foi alterado/)).toBeTruthy()
    expect(chamadas.perfilUpdate).not.toHaveBeenCalled()
    expect(screen.queryByText(/aguarda a aprovação/)).toBeNull()
  })

  it("falha ao ler a visibilidade oferece tentar de novo", async () => {
    resp.perfil = { data: null, error: { message: "boom" } }
    monta()
    expect(await screen.findByRole("button", { name: "Tentar de novo" })).toBeTruthy()
  })

  it("cookies não se retiram aqui: leva à página de cookies", async () => {
    resp.aceites = { data: [{ id: 8, aceito_em: "2026-10-30T10:00:00Z", revogado_em: null, documentos_legais: { tipo: "cookies", versao: "v1", titulo: "Cookies" } }], error: null }
    monta()
    const tabela = await screen.findByRole("table", { name: "Meus consentimentos" })
    expect(within(tabela).queryByRole("button")).toBeNull()
    expect(within(tabela).getByRole("link", { name: "Gerencie nos cookies" }).getAttribute("href")).toBe("/pt/cookies")
  })

  it("ligar o Match registra o aceite do texto vigente (também com o texto só em outro idioma)", async () => {
    monta("/en")
    await userEvent.click(await screen.findByText(/Read the text/))
    await waitFor(() => expect((screen.getByRole("switch", { name: "Take part in Business Match" }) as HTMLInputElement).disabled).toBe(false))
    await userEvent.click(await screen.findByRole("switch", { name: "Take part in Business Match" }))
    await waitFor(() => expect(chamadas.insert).toHaveBeenCalledTimes(1))
    expect(chamadas.insert.mock.calls[0][0]).toMatchObject({ documento_id: 7, perfil_id: "u1", titular_email: "ana@exemplo.invalid" })
  })

  it("INSERT que o banco não confirma (vazio) vira erro", async () => {
    resp.insert = { data: [], error: null }
    monta()
    await userEvent.click(await screen.findByText(/Ler o texto/))
    await userEvent.click(await screen.findByRole("switch", { name: "Participar do Business Match" }))
    expect((await screen.findAllByRole("alert")).some((a) => /não conseguimos atualizar esta autorização/i.test(a.textContent ?? ""))).toBe(true)
  })

  it("desligar o Match revoga o aceite ativo", async () => {
    resp.aceites = { data: [aceiteMatch], error: null }
    monta()
    const sw = await screen.findByRole("switch", { name: "Participar do Business Match" })
    expect((sw as HTMLInputElement).checked).toBe(true)
    await userEvent.click(sw)
    await waitFor(() => expect(chamadas.revoga).toHaveBeenCalledTimes(1))
    expect(chamadas.revoga.mock.calls[0][0]).toHaveProperty("revogado_em")
  })

  it("depois de retirar, o foco vai para o título da lista", async () => {
    resp.aceites = { data: [aceiteMatch], error: null }
    monta()
    await userEvent.click(await screen.findByRole("button", { name: /^Retirar/ }))
    await userEvent.click(within(screen.getByRole("dialog", { hidden: true })).getByRole("button", { name: "Retirar", hidden: true }))
    await waitFor(() => expect(document.activeElement?.textContent).toBe("Meus consentimentos"))
  })

  it("lista: retirar só nos consentimentos que são escolha; termos são condição da conta; confirma em diálogo", async () => {
    resp.aceites = { data: [aceiteMatch, aceiteTermos], error: null }
    monta()
    const tabela = await screen.findByRole("table", { name: "Meus consentimentos" })
    const linhas = within(tabela).getAllByRole("row")
    expect(within(linhas[1]).getByRole("button", { name: /Retirar/ })).toBeTruthy()
    expect(within(linhas[2]).queryByRole("button")).toBeNull()
    expect(within(linhas[2]).getByText("Condição da conta")).toBeTruthy()
    await userEvent.click(within(linhas[1]).getByRole("button", { name: /Retirar/ }))
    expect(chamadas.revoga).not.toHaveBeenCalled()
    await userEvent.click(within(screen.getByRole("dialog", { hidden: true })).getByRole("button", { name: "Retirar", hidden: true }))
    await waitFor(() => expect(chamadas.revoga).toHaveBeenCalledTimes(1))
  })

  it.each(["/pt", "/en"])("sem violações de acessibilidade (axe) em %s", async (url) => {
    resp.aceites = { data: [aceiteMatch, aceiteTermos], error: null }
    monta(url)
    await screen.findByRole("table")
    expect(await violacoes()).toEqual([])
  })
})
