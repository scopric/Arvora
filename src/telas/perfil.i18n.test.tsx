import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Mesmo esquema de mocks do Perfil.test.tsx; aqui o foco é o idioma.
const resp = vi.hoisted(() => ({ perfil: {} as unknown, setores: {} as unknown, clientes: {} as unknown }))
vi.mock("../lib/supabase", () => {
  const consulta = (valor: () => unknown) => {
    const q: Record<string, unknown> = {}
    for (const m of ["select", "eq", "order", "limit"]) q[m] = () => q
    q.maybeSingle = () => Promise.resolve(valor())
    q.then = (ok: (v: unknown) => unknown) => Promise.resolve(valor()).then(ok)
    return q
  }
  return {
    supabase: {
      from: (tabela: string) =>
        tabela === "setores" ? consulta(() => resp.setores) : tabela === "clientes_stripe" ? consulta(() => resp.clientes) : { select: () => consulta(() => resp.perfil) },
    },
  }
})
vi.mock("../lib/sessao", () => ({
  useAuth: () => ({ sessao: { user: { id: "u1", email: "a@b.com" } }, carregando: false }),
  sair: vi.fn(),
}))

import { en } from "../i18n/en"
import { pt } from "../i18n/pt"
import { Perfil } from "./Perfil"

const perfilOk = {
  nome: "Ana", empresa_nome: null, setor_id: 1, cidade: null, pais: null,
  linkedin_url: null, instagram: null, bio: null, visibilidade: "publico", publico_aprovado_em: null,
}
const ir = (lang: "pt" | "en") =>
  render(
    <MemoryRouter initialEntries={[`/${lang}/perfil`]}>
      <Routes>
        <Route path="/:lang/perfil" element={<Perfil />} />
      </Routes>
    </MemoryRouter>,
  )

beforeEach(() => {
  resp.perfil = { data: perfilOk, error: null }
  resp.setores = { data: [{ id: 1, nome: "Educação", nome_en: "Education" }, { id: 2, nome: "Outro", nome_en: null }], error: null }
  resp.clientes = { data: [{ id: 1 }], error: null }
})
afterEach(cleanup)

// Palavras só do português (as do inglês não colidem: "Nome" vs "Name", "Perfil" vs "Profile").
const PORTUGUES = /Salvar|Nome|Cidade|Perfil|perfil|Setor|Visibilidade|Membros|membros|Empresa|Sobre você|Sair|Carregando|Selecione|Assinatura|assinatura|conta|Excluir|Baixar|Cancelar|senha|Senha|equipe|Aguarde|Você|acesso|definitiv|reembolso|obrigação|cobrança|Quero|Corrija|Informe|Escolha|Use o|No máximo|Só /

describe("Perfil em /en", () => {
  it("não tem texto em português (inclui bloco de conta aberto e erros do Zod)", async () => {
    resp.perfil = { data: { ...perfilOk, nome: "" }, error: null }
    ir("en")
    await userEvent.click(await screen.findByRole("button", { name: en["perfil.salvar"] }))
    await screen.findAllByRole("alert")
    await userEvent.click(screen.getByRole("button", { name: en["perfil.excluir.abrir"] }))
    await screen.findByRole("button", { name: en["perfil.assinatura.gerenciar"] })
    const texto = document.body.textContent ?? ""
    expect(texto).not.toMatch(PORTUGUES)
    expect(texto.length).toBeGreaterThan(200)
  })

  it("estados de carregamento e de erro de leitura também", async () => {
    ir("en")
    expect(screen.getByRole("status").textContent).toBe(en["comum.carregando"])
    cleanup()
    resp.perfil = { data: null, error: { message: "boom" } }
    ir("en")
    expect((await screen.findByRole("alert")).textContent).toBe(en["perfil.erroCarregar"])
  })

  it("erro do Zod aparece em EN (e em PT em /pt)", async () => {
    resp.perfil = { data: { ...perfilOk, nome: "" }, error: null }
    ir("en")
    await userEvent.click(await screen.findByRole("button", { name: en["perfil.salvar"] }))
    expect(await screen.findByText(en["validacao.nome.obrigatorio"])).toBeTruthy()
    expect(screen.getByText(en["perfil.corrija"])).toBeTruthy()
    cleanup()
    ir("pt")
    await userEvent.click(await screen.findByRole("button", { name: pt["perfil.salvar"] }))
    expect(await screen.findByText(pt["validacao.nome.obrigatorio"])).toBeTruthy()
  })

  it("placeholder do LinkedIn em inglês", async () => {
    ir("en")
    expect(((await screen.findByLabelText("LinkedIn")) as HTMLInputElement).placeholder).toBe("https://linkedin.com/in/your-name")
  })
})

describe("setor no select", () => {
  const opcoes = () => screen.getAllByRole("option").map((o) => o.textContent)
  it("EN mostra nome_en e cai em nome quando nome_en é nulo", async () => {
    ir("en")
    await screen.findByRole("combobox")
    expect(opcoes()).toEqual(["Select", "Education", "Outro"])
  })
  it("PT mostra nome", async () => {
    ir("pt")
    await screen.findByRole("combobox")
    expect(opcoes()).toEqual(["Selecione", "Educação", "Outro"])
  })
})
