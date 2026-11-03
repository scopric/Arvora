import { cleanup, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../../lib/supabase", async () => (await import("./supabaseFalso")).moduloFalso)
vi.mock("../../lib/sessao", async () => (await import("./supabaseFalso")).moduloSessao)

import { montar } from "./montar"
import { estado, falso, zerar } from "./supabaseFalso"
import { CadastrarEmpresa } from "./telas/CadastrarEmpresa"
import { Directory } from "./telas/Directory"
import { DirectoryEmpresa } from "./telas/DirectoryEmpresa"

beforeEach(() => {
  zerar()
  estado.sessao = null
  falso.tabelas.setores = { data: [{ id: 1, nome: "Tecnologia", nome_en: "Technology", slug: "tecnologia" }, { id: 2, nome: "Construção", nome_en: null, slug: "construcao" }], error: null }
})
afterEach(cleanup)

describe("Directory", () => {
  const empresas = [
    { id: 1, nome: "Alfa", slug: "alfa", setor_id: 1, cidade: "Dublin", pais: "IE", logo_path: null },
    { id: 2, nome: "Beta", slug: "beta", setor_id: 2, cidade: "Cork", pais: "IE", logo_path: null },
  ]
  it("filtra por área e cidade, mostra selo Premiado e o vazio do filtro", async () => {
    falso.tabelas.empresas = { data: empresas, error: null }
    falso.tabelas.premiados = { data: [{ empresa_id: 2 }], error: null }
    montar(<Directory />, "/:lang/directory", "/pt/directory")
    expect(await screen.findByRole("link", { name: "Alfa" })).toBeTruthy()
    expect(screen.getByText("Premiado")).toBeTruthy()
    await userEvent.selectOptions(screen.getByLabelText("Área"), "construcao")
    expect(screen.queryByRole("link", { name: "Alfa" })).toBeNull()
    expect(screen.getByRole("link", { name: "Beta" })).toBeTruthy()
    await userEvent.selectOptions(screen.getByLabelText("Cidade"), "Dublin")
    expect(screen.getByText(/Nenhuma empresa com esses filtros/)).toBeTruthy()
  })
  it("erro de leitura não vira lista vazia", async () => {
    falso.tabelas.empresas = { data: null, error: { message: "x" } }
    montar(<Directory />, "/:lang/directory", "/pt/directory")
    expect(await screen.findByRole("button", { name: "Tentar de novo" })).toBeTruthy()
  })
})

describe("DirectoryEmpresa", () => {
  const ver = () => montar(<DirectoryEmpresa />, "/:lang/directory/:slug", "/pt/directory/alfa")
  it("só consulta área, premiado e parecidas depois de carregar a empresa; sem empresa, não consulta", async () => {
    falso.tabelas.empresas = { data: [], error: null }
    ver()
    expect(await screen.findByText("Não encontramos esta página")).toBeTruthy()
    expect(falso.chamadas.filter((c) => c.tabela === "setores" || c.tabela === "premiados")).toEqual([])
    await waitFor(() => expect(document.title).toBe("Não encontramos esta página — Grupo Árvora"))
    await waitFor(() => expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex"))
  })
  it("título da aba com o nome da empresa; erro nas consultas de apoio aparece; selo exige premiado publicado", async () => {
    falso.tabelas.empresas = { data: [{ id: 1, nome: "Alfa", setor_id: 1, cidade: null, pais: null, logo_path: null }], error: null }
    falso.tabelas.setores = { data: null, error: { message: "x" } }
    falso.tabelas.premiados = { data: [], error: null }
    ver()
    expect(await screen.findByRole("heading", { level: 1, name: "Alfa" })).toBeTruthy()
    await waitFor(() => expect(document.title).toBe("Alfa — Grupo Árvora"))
    expect((await screen.findAllByRole("button", { name: "Tentar de novo" })).length).toBeGreaterThan(0)
    expect(falso.chamadas.some((c) => c.tabela === "premiados" && c.op === "not" && c.args[0] === "publicado_em")).toBe(true)
  })
})

describe("CadastrarEmpresa", () => {
  const logar = (nivel: "visitante" | "clube" = "clube") => {
    estado.sessao = { user: { id: "u1", email: "a@b.invalid" } }
    return montar(<CadastrarEmpresa />, "/:lang/cadastrar-empresa", "/pt/cadastrar-empresa", { nivel })
  }
  it("visitante sem sessão pede login; sem Clube vê o cadeado", async () => {
    montar(<CadastrarEmpresa />, "/:lang/cadastrar-empresa", "/pt/cadastrar-empresa")
    expect(screen.getByRole("link", { name: "Entrar" })).toBeTruthy()
    expect(falso.rpc).not.toHaveBeenCalled()
    cleanup()
    logar("visitante")
    expect(screen.getByText(/Bloqueado: parte do Clube/)).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Enviar para revisão" })).toBeNull()
  })
  it("valida campos ao lado do campo e só então insere (sem dono, status ou aprovação vindos da tela)", async () => {
    falso.tabelas.empresas = { data: [{ id: 5 }], error: null }
    logar()
    await userEvent.click(await screen.findByRole("button", { name: "Enviar para revisão" }))
    expect(await screen.findByText("Informe o nome da empresa (até 160 caracteres).")).toBeTruthy()
    expect(screen.getByText("Escolha uma área.")).toBeTruthy()
    expect(falso.chamadas.some((c) => c.op === "insert")).toBe(false)
    await userEvent.type(screen.getByLabelText("Nome da empresa"), "Café Exemplo")
    await userEvent.selectOptions(screen.getByLabelText("Área"), "1")
    await userEvent.type(screen.getByLabelText("País (código de 2 letras)"), "ie")
    await userEvent.click(screen.getByRole("button", { name: "Enviar para revisão" }))
    expect(await screen.findByText(/pendente de aprovação/)).toBeTruthy()
    // Depois de enviar o formulário some (nada de reenvio com os mesmos dados); "Cadastrar outra" traz um formulário limpo.
    expect(screen.queryByRole("button", { name: "Enviar para revisão" })).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "Cadastrar outra empresa" }))
    expect((screen.getByLabelText("Nome da empresa") as HTMLInputElement).value).toBe("")
    const dado = falso.chamadas.find((c) => c.op === "insert")?.args[0] as Record<string, unknown>
    expect(dado).toMatchObject({ nome: "Café Exemplo", setor_id: 1, pais: "IE", cidade: null, site: null })
    expect(String(dado.slug)).toMatch(/^cafe-exemplo-[0-9a-f]{6}$/)
    expect(Object.keys(dado).sort()).toEqual(["cidade", "descricao", "nome", "pais", "setor_id", "site", "slug"])
  })
  it("lista as empresas do dono pela RPC minhas_empresas, com o estado de cada uma", async () => {
    falso.rpc.mockResolvedValue({ data: [{ id: 1, nome: "Minha Pendente", status: "pendente" }, { id: 2, nome: "Minha Publicada", status: "publicada" }], error: null })
    logar()
    expect(await screen.findByText("Minha Pendente")).toBeTruthy()
    expect(screen.getByText("Pendente de aprovação")).toBeTruthy()
    expect(screen.getByText("Publicada")).toBeTruthy()
    expect(falso.rpc).toHaveBeenCalledWith("minhas_empresas")
  })
  it("resposta vazia do insert (RLS recusou) mostra erro, não 'pendente'", async () => {
    falso.tabelas.empresas = { data: [], error: null }
    logar()
    await userEvent.type(await screen.findByLabelText("Nome da empresa"), "X")
    await userEvent.selectOptions(screen.getByLabelText("Área"), "1")
    await userEvent.click(screen.getByRole("button", { name: "Enviar para revisão" }))
    await waitFor(() => expect(screen.getByText(/Não conseguimos enviar o cadastro/)).toBeTruthy())
    expect(screen.queryByText(/pendente de aprovação/)).toBeNull()
  })
})
