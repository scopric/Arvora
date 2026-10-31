import { cleanup, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { renderiza } from "../../../testeUtil"
import { violacoes } from "../testeConta"

const resp = vi.hoisted(() => ({ lista: {} as unknown, update: {} as unknown, apaga: {} as unknown }))
vi.mock("../../../lib/supabase", async () => {
  const { consulta } = await import("../testeConta")
  return {
    supabase: {
      from: () => ({
        select: () => consulta(() => resp.lista),
        update: () => consulta(() => resp.update),
        delete: () => consulta(() => resp.apaga),
      }),
    },
  }
})
vi.mock("../../../lib/sessao", () => ({
  useAuth: () => ({ sessao: { user: { id: "u1", email: "ana@exemplo.invalid" } }, carregando: false }),
  sair: vi.fn(),
}))

import { Notificacoes } from "./Notificacoes"

const item = (id: number, lida: string | null) => ({ id, titulo: `Aviso ${id}`, link: "/tarefas", lida_em: lida, criado_em: "2026-10-30T12:00:00Z" })

beforeEach(() => {
  resp.lista = { data: [item(1, null), item(2, "2026-10-30T13:00:00Z")], error: null }
  resp.update = { data: [{ id: 1 }], error: null }
  resp.apaga = { data: [{ id: 2 }], error: null }
})
afterEach(cleanup)

describe("tela Notificações", () => {
  it("sem notificações mostra 'tudo em dia'", async () => {
    resp.lista = { data: [], error: null }
    renderiza(<Notificacoes />)
    expect(await screen.findByText(/tudo em dia/i)).toBeTruthy()
  })

  it("falha de leitura aparece como erro, não como 'tudo em dia'", async () => {
    resp.lista = { data: null, error: { message: "boom" } }
    renderiza(<Notificacoes />)
    expect((await screen.findByRole("alert")).textContent).toMatch(/não conseguimos carregar/i)
    expect(screen.queryByText(/tudo em dia/i)).toBeNull()
  })

  it("lista com data e link no idioma; marcar como lida tira o selo 'Nova'", async () => {
    renderiza(<Notificacoes />, "/en")
    expect(await screen.findByText("Aviso 1")).toBeTruthy()
    expect(screen.getAllByText("30/10/2026", { selector: "time" })).toHaveLength(2)
    expect(screen.getAllByRole("link", { name: /Open: Aviso/ })[0].getAttribute("href")).toBe("/en/tarefas")
    expect(screen.getAllByText("New")).toHaveLength(1)
    await userEvent.click(screen.getByRole("button", { name: /Mark as read: Aviso 1/ }))
    await waitFor(() => expect(screen.queryByText("New")).toBeNull())
  })

  it("UPDATE que não casa linha (RLS) vira erro e a notificação continua nova", async () => {
    resp.update = { data: [], error: null }
    renderiza(<Notificacoes />)
    await userEvent.click(await screen.findByRole("button", { name: /marcar como lida: Aviso 1/i }))
    expect((await screen.findByRole("alert")).textContent).toMatch(/não conseguimos atualizar/i)
    expect(screen.getByText("Nova")).toBeTruthy()
  })

  it("apagar remove da lista só depois de o banco confirmar", async () => {
    renderiza(<Notificacoes />)
    await userEvent.click(await screen.findByRole("button", { name: /apagar: Aviso 2/i }))
    await waitFor(() => expect(screen.queryByText("Aviso 2")).toBeNull())
    expect(screen.getByText("Aviso 1")).toBeTruthy()
  })

  it("apagar sem confirmação do banco mantém a notificação e avisa", async () => {
    resp.apaga = { data: [], error: null }
    renderiza(<Notificacoes />)
    await userEvent.click(await screen.findByRole("button", { name: /apagar: Aviso 2/i }))
    expect((await screen.findByRole("alert")).textContent).toMatch(/não conseguimos atualizar/i)
    expect(screen.getByText("Aviso 2")).toBeTruthy()
  })

  it.each(["/pt", "/en"])("sem violações de acessibilidade (axe) em %s", async (url) => {
    renderiza(<main><Notificacoes /></main>, url)
    await screen.findByText("Aviso 1")
    expect(await violacoes()).toEqual([])
  })
})
