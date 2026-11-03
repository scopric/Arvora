import { cleanup, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { renderiza } from "../testeUtil"

// O comportamento sob RLS de verdade é provado no pgTAP; aqui só o que a tela faz com cada resposta.
const resp = vi.hoisted(() => ({ perfil: {} as unknown, setores: {} as unknown, update: {} as unknown, clientes: {} as unknown, chamadas: 0, ultimo: null as unknown }))

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
        tabela === "setores"
          ? consulta(() => resp.setores)
          : tabela === "clientes_stripe"
            ? consulta(() => resp.clientes)
            : {
              select: () => consulta(() => resp.perfil),
              update: (v: unknown) => (resp.chamadas++, resp.ultimo = v, { eq: () => ({ select: () => Promise.resolve(resp.update) }) }),
            },
    },
  }
})
const abrirPortal = vi.hoisted(() => vi.fn())
vi.mock("../lib/assinatura", () => ({ abrirPortal }))
vi.mock("../lib/sessao", () => ({
  useAuth: () => ({ sessao: { user: { id: "u1", email: "a@b.com" } }, carregando: false }),
  sair: vi.fn(),
}))

import { Perfil } from "./Perfil"

const perfilOk = {
  nome: "Ana", empresa_nome: null, setor_id: null, cidade: null, pais: null,
  linkedin_url: null, instagram: null, bio: null, visibilidade: "membros", publico_aprovado_em: null,
}

afterEach(cleanup)

beforeEach(() => {
  resp.perfil = { data: perfilOk, error: null }
  resp.setores = { data: [{ id: 1, nome: "Educação" }], error: null }
  resp.update = { data: [{ id: "u1" }], error: null }
  resp.clientes = { data: [], error: null }
  resp.chamadas = 0
  abrirPortal.mockReset()
})

describe("tela Meu perfil", () => {
  it("falha de leitura aparece como mensagem, não como formulário vazio", async () => {
    resp.perfil = { data: null, error: { message: "boom" } }
    renderiza(<Perfil />)
    expect((await screen.findByRole("alert")).textContent).toMatch(/não conseguimos carregar/i)
    expect(screen.queryByLabelText("Nome")).toBeNull()
  })

  it("UPDATE que não casa nenhuma linha (RLS) vira erro, não 'Perfil salvo'", async () => {
    resp.update = { data: [], error: null }
    renderiza(<Perfil />)
    await userEvent.click(await screen.findByRole("button", { name: /salvar alterações/i }))
    const alertas = await screen.findAllByRole("alert")
    expect(alertas[0].textContent).toMatch(/não conseguimos salvar/i)
    expect(screen.queryByText("Perfil salvo.")).toBeNull()
  })

  it("salva quando o banco devolve a linha", async () => {
    renderiza(<Perfil />)
    await userEvent.click(await screen.findByRole("button", { name: /salvar alterações/i }))
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Perfil salvo."))
  })

  it("não envia nada ao banco com campo inválido", async () => {
    renderiza(<Perfil />)
    await userEvent.type(await screen.findByRole("textbox", { name: "LinkedIn" }), "linkedin.com/in/ana")
    await userEvent.click(screen.getByRole("button", { name: /salvar alterações/i }))
    expect(await screen.findByText(/começando com https:\/\/linkedin.com/i)).toBeTruthy()
    expect(resp.chamadas).toBe(0)
  })

  it("país é lista: escolher Irlanda grava IE (não IR)", async () => {
    renderiza(<Perfil />)
    const pais = await screen.findByRole("combobox", { name: "País" })
    expect(pais.getAttribute("autocomplete")).toBe("country")
    await userEvent.selectOptions(pais, "Irlanda")
    await userEvent.click(screen.getByRole("button", { name: /salvar alterações/i }))
    await waitFor(() => expect(resp.chamadas).toBe(1))
    expect(resp.ultimo).toMatchObject({ pais: "IE" })
  })

  it("código antigo fora da lista aparece no select e volta igual ao salvar", async () => {
    resp.perfil = { data: { ...perfilOk, pais: "XX" }, error: null }
    renderiza(<Perfil />)
    const pais = (await screen.findByRole("combobox", { name: "País" })) as HTMLSelectElement
    expect(pais.value).toBe("XX")
    await userEvent.click(screen.getByRole("button", { name: /salvar alterações/i }))
    await waitFor(() => expect(resp.chamadas).toBe(1))
    expect(resp.ultimo).toMatchObject({ pais: "XX" })
  })

  it("exportar, excluir e visibilidade saíram: ficam só os links para as Configurações", async () => {
    renderiza(<Perfil />)
    await screen.findByRole("button", { name: /salvar alterações/i })
    expect(screen.queryByRole("button", { name: /baixar meus dados/i })).toBeNull()
    expect(screen.queryByRole("button", { name: /excluir/i })).toBeNull()
    expect(screen.queryByRole("radio")).toBeNull()
    expect(screen.getByRole("link", { name: /privacidade/i }).getAttribute("href")).toBe("/pt/configuracoes/privacidade")
    expect(screen.getByRole("link", { name: /meus dados/i }).getAttribute("href")).toBe("/pt/configuracoes/dados")
  })

  it("salvar não muda a visibilidade (vai a mesma que veio do banco)", async () => {
    resp.perfil = { data: { ...perfilOk, visibilidade: "publico" }, error: null }
    renderiza(<Perfil />)
    await userEvent.click(await screen.findByRole("button", { name: /salvar alterações/i }))
    await waitFor(() => expect(resp.chamadas).toBe(1))
    expect(resp.ultimo).toMatchObject({ visibilidade: "publico" })
  })
})

describe("bloco Assinatura", () => {
  it("não aparece para quem não tem cliente no Stripe", async () => {
    renderiza(<Perfil />)
    await screen.findByRole("button", { name: /salvar alterações/i })
    expect(screen.queryByRole("button", { name: /gerenciar assinatura/i })).toBeNull()
  })

  it("aparece para quem tem cliente e abre o portal", async () => {
    resp.clientes = { data: [{ id: 1 }], error: null }
    abrirPortal.mockResolvedValue(null)
    renderiza(<Perfil />)
    await userEvent.click(await screen.findByRole("button", { name: /gerenciar assinatura/i }))
    expect(abrirPortal).toHaveBeenCalledWith("pt")
  })

  it("falha ao abrir o portal aparece na tela", async () => {
    resp.clientes = { data: [{ id: 1 }], error: null }
    abrirPortal.mockResolvedValue("perfil.assinatura.erroPortal")
    renderiza(<Perfil />)
    await userEvent.click(await screen.findByRole("button", { name: /gerenciar assinatura/i }))
    expect((await screen.findByRole("alert")).textContent).toMatch(/não conseguimos abrir/i)
  })

  it("falha ao consultar aparece na tela, não some", async () => {
    resp.clientes = { data: null, error: { message: "boom" } }
    renderiza(<Perfil />)
    expect((await screen.findByRole("alert")).textContent).toMatch(/verificar sua assinatura/i)
  })
})
