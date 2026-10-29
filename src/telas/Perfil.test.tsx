import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// O comportamento sob RLS de verdade é provado no pgTAP; aqui só o que a tela faz com cada resposta.
const resp = vi.hoisted(() => ({ perfil: {} as unknown, setores: {} as unknown, update: {} as unknown, clientes: {} as unknown, chamadas: 0 }))

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
              update: () => (resp.chamadas++, { eq: () => ({ select: () => Promise.resolve(resp.update) }) }),
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
    render(<Perfil />)
    expect((await screen.findByRole("alert")).textContent).toMatch(/não conseguimos carregar/i)
    expect(screen.queryByLabelText("Nome")).toBeNull()
  })

  it("UPDATE que não casa nenhuma linha (RLS) vira erro, não 'Perfil salvo'", async () => {
    resp.update = { data: [], error: null }
    render(<Perfil />)
    await userEvent.click(await screen.findByRole("button", { name: /salvar alterações/i }))
    const alertas = await screen.findAllByRole("alert")
    expect(alertas[0].textContent).toMatch(/não conseguimos salvar/i)
    expect(screen.queryByText("Perfil salvo.")).toBeNull()
  })

  it("salva quando o banco devolve a linha", async () => {
    render(<Perfil />)
    await userEvent.click(await screen.findByRole("button", { name: /salvar alterações/i }))
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Perfil salvo."))
  })

  it("não envia nada ao banco com campo inválido", async () => {
    render(<Perfil />)
    await userEvent.type(await screen.findByRole("textbox", { name: "País" }), "x1")
    await userEvent.click(screen.getByRole("button", { name: /salvar alterações/i }))
    expect(await screen.findByText(/código de 2 letras/i)).toBeTruthy()
    expect(resp.chamadas).toBe(0)
  })
})

describe("bloco Assinatura", () => {
  it("não aparece para quem não tem cliente no Stripe", async () => {
    render(<Perfil />)
    await screen.findByRole("button", { name: /salvar alterações/i })
    expect(screen.queryByRole("button", { name: /gerenciar assinatura/i })).toBeNull()
  })

  it("aparece para quem tem cliente e abre o portal", async () => {
    resp.clientes = { data: [{ id: 1 }], error: null }
    abrirPortal.mockResolvedValue(null)
    render(<Perfil />)
    await userEvent.click(await screen.findByRole("button", { name: /gerenciar assinatura/i }))
    expect(abrirPortal).toHaveBeenCalledWith("pt")
  })

  it("falha ao abrir o portal aparece na tela", async () => {
    resp.clientes = { data: [{ id: 1 }], error: null }
    abrirPortal.mockResolvedValue("Não conseguimos abrir a página de pagamento agora.")
    render(<Perfil />)
    await userEvent.click(await screen.findByRole("button", { name: /gerenciar assinatura/i }))
    expect((await screen.findByRole("alert")).textContent).toMatch(/não conseguimos abrir/i)
  })

  it("falha ao consultar aparece na tela, não some", async () => {
    resp.clientes = { data: null, error: { message: "boom" } }
    render(<Perfil />)
    expect((await screen.findByRole("alert")).textContent).toMatch(/verificar sua assinatura/i)
  })
})
