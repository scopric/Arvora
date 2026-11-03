import { cleanup, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../../lib/supabase", async () => (await import("./supabaseFalso")).moduloFalso)
vi.mock("../../lib/sessao", async () => (await import("./supabaseFalso")).moduloSessao)

import { montar } from "./montar"
import { estado, falso, zerar } from "./supabaseFalso"
import { HallOfFame, Premiado } from "./telas/HallOfFame"

const linha = { id: 1, nome: "Premiado Um", slug: "p1", historia: "Uma história.", foto_path: null, materia_url: "javascript:x", edicoes: { slug: "ed-teste", nome: "Edição Teste" }, categorias_premio: { nome: "Inovação" } }
beforeEach(() => {
  zerar()
  estado.sessao = null
})
afterEach(cleanup)
const lista = () => montar(<HallOfFame />, "/:lang/hall-of-fame", "/pt/hall-of-fame")
const detalhe = () => montar(<Premiado />, "/:lang/hall-of-fame/:edicao/:slug", "/pt/hall-of-fame/ed-teste/p1")

describe("Hall of Fame", () => {
  it("lista só publicados do banco, com link para a página do premiado", async () => {
    falso.tabelas.premiados = { data: [linha], error: null }
    lista()
    expect((await screen.findByRole("link", { name: "Premiado Um" })).getAttribute("href")).toBe("/pt/hall-of-fame/ed-teste/p1")
    expect(screen.getByText("Inovação · Edição Teste")).toBeTruthy()
    expect(falso.chamadas.some((c) => c.op === "not" && c.args[0] === "publicado_em")).toBe(true)
    await waitFor(() => expect(document.title).toBe("Hall of Fame — Grupo Árvora"))
  })
  it("lista vazia: estado vazio, sem erro", async () => {
    falso.tabelas.premiados = { data: [], error: null }
    lista()
    expect(await screen.findByText(/Os premiados aparecem aqui/)).toBeTruthy()
    expect(screen.queryByRole("alert")).toBeNull()
  })
  it("erro de leitura não vira lista vazia", async () => {
    falso.tabelas.premiados = { data: null, error: { message: "x" } }
    lista()
    expect(await screen.findByRole("button", { name: /tentar/i })).toBeTruthy()
    expect(screen.queryByText(/Os premiados aparecem aqui/)).toBeNull()
  })
  it("premiado: nome no título da aba, história, e matéria não-https não vira link", async () => {
    falso.tabelas.premiados = { data: [linha], error: null }
    detalhe()
    expect(await screen.findByRole("heading", { level: 1, name: "Premiado Um" })).toBeTruthy()
    expect(screen.getByText("Uma história.")).toBeTruthy()
    expect(screen.queryByRole("link", { name: "Ler a matéria" })).toBeNull()
    await waitFor(() => expect(document.title).toBe("Premiado Um — Grupo Árvora"))
  })
  it("premiado inexistente: página 'não encontrada' com noindex, sem erro", async () => {
    falso.tabelas.premiados = { data: [], error: null }
    detalhe()
    expect(await screen.findByRole("heading", { level: 1, name: "Não encontramos esta página" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Voltar ao Hall of Fame" }).getAttribute("href")).toBe("/pt/hall-of-fame")
    expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex")
  })
})
