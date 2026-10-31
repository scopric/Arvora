import { cleanup, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { renderiza } from "../../../testeUtil"
import { violacoes } from "../testeConta"

const resp = vi.hoisted(() => ({ docs: {} as unknown, aceites: {} as unknown }))
vi.mock("../../../lib/supabase", async () => {
  const { consulta } = await import("../testeConta")
  return { supabase: { from: (tabela: string) => ({ select: () => consulta(() => (tabela === "documentos_legais" ? resp.docs : resp.aceites)) }) } }
})
vi.mock("../../../lib/sessao", () => ({
  useAuth: () => ({ sessao: { user: { id: "u1", email: "ana@exemplo.invalid" } }, carregando: false }),
  sair: vi.fn(),
}))

import { Emails } from "./Emails"

beforeEach(() => {
  resp.docs = { data: [], error: null }
  resp.aceites = { data: [], error: null }
})
afterEach(cleanup)

describe("tela E-mails", () => {
  it("transacional fica ligado e travado; marketing sem texto publicado fica desligado, travado e 'em breve'", async () => {
    renderiza(<main><Emails /></main>)
    const transacional = await screen.findByRole("switch", { name: /E-mails da conta/ })
    expect((transacional as HTMLInputElement).checked).toBe(true)
    expect((transacional as HTMLInputElement).disabled).toBe(true)
    const marketing = screen.getByRole("switch", { name: /Receber novidades/ })
    expect((marketing as HTMLInputElement).checked).toBe(false)
    expect((marketing as HTMLInputElement).disabled).toBe(true)
    expect(screen.getByText(/Em breve/)).toBeTruthy()
  })

  it("com texto de marketing vigente o interruptor pode ser ligado", async () => {
    resp.docs = { data: [{ id: 6, tipo: "marketing", idioma: "pt", versao: "v1", titulo: "Marketing", conteudo_md: "Texto." }], error: null }
    renderiza(<main><Emails /></main>)
    const marketing = await screen.findByRole("switch", { name: /Receber novidades/ })
    expect((marketing as HTMLInputElement).disabled).toBe(true) // antes de ver o texto, não liga
    await userEvent.click(screen.getByText(/Ler o texto/))
    await waitFor(() => expect((marketing as HTMLInputElement).disabled).toBe(false))
  })

  it("falha de leitura aparece como erro", async () => {
    resp.aceites = { data: null, error: { message: "boom" } }
    renderiza(<main><Emails /></main>)
    expect((await screen.findByRole("alert")).textContent).toMatch(/não conseguimos carregar/i)
  })

  it.each(["/pt", "/en"])("sem violações de acessibilidade (axe) em %s", async (url) => {
    renderiza(<main><Emails /></main>, url)
    await screen.findByText(/Em breve|Coming soon/)
    expect(await violacoes()).toEqual([])
  })
})
