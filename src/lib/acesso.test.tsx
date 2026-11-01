import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({
  sessao: null as { user: { id: string } } | null,
  grupo: false,
  clube: false,
  erro: false,
  equipe: null as { papel: string } | null,
  premiados: [] as { id: number }[],
  premiadosFalha: false,
}))
vi.mock("./sessao", () => ({ useAuth: () => ({ sessao: h.sessao, carregando: false }) }))
vi.mock("./supabase", () => {
  const resposta = (data: unknown) => Promise.resolve(h.erro ? { data: null, error: { message: "falhou" } } : { data, error: null })
  return {
    supabase: {
      rpc: (_n: string, { minimo }: { minimo: string }) => resposta(minimo === "grupo" ? h.grupo : h.clube),
      from: (tabela: string) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () => resposta(h.equipe),
            limit: () => (tabela === "premiados" && h.premiadosFalha ? Promise.resolve({ data: null, error: { message: "sem tabela" } }) : resposta(tabela === "premiados" ? h.premiados : [])),
          }),
        }),
      }),
    },
  }
})

import { AcessoProvider } from "./AcessoProvider"
import { temNivel, useAcesso } from "./acesso"

function Mostra() {
  const a = useAcesso()
  return (
    <div>
      <p data-testid="estado">{a.carregando ? "carregando" : a.erro ? "erro" : "pronto"}</p>
      <p data-testid="dados">{`${a.nivel}|${a.premiado}|${a.equipe}|${a.papel}`}</p>
      <button onClick={a.recarregar}>de novo</button>
    </div>
  )
}
const montar = () => render(<AcessoProvider><Mostra /></AcessoProvider>)
const dados = () => screen.getByTestId("dados").textContent

beforeEach(() => Object.assign(h, { sessao: { user: { id: "u1" } }, grupo: false, clube: false, erro: false, equipe: null, premiados: [], premiadosFalha: false }))
afterEach(cleanup)

describe("useAcesso", () => {
  it("sem sessão: visitante, já carregado, sem consultar o banco", () => {
    h.sessao = null
    montar()
    expect(screen.getByTestId("estado").textContent).toBe("pronto")
    expect(dados()).toBe("visitante|false|false|null")
  })

  it("nível vem de tem_acesso: grupo > clube > visitante", async () => {
    h.grupo = true
    h.clube = true
    montar()
    await waitFor(() => expect(screen.getByTestId("estado").textContent).toBe("pronto"))
    expect(dados()).toBe("grupo|false|false|null")
    cleanup()
    Object.assign(h, { grupo: false, clube: true })
    montar()
    await waitFor(() => expect(dados()).toBe("clube|false|false|null"))
  })

  it("premiado (linha em premiados) e equipe (linha em equipe, com papel)", async () => {
    h.premiados = [{ id: 7 }]
    h.equipe = { papel: "editor" }
    montar()
    await waitFor(() => expect(dados()).toBe("visitante|true|true|editor"))
  })

  it("falha só na leitura de premiado não derruba nível nem equipe: premiado = false, sem erro", async () => {
    h.grupo = true
    h.clube = true
    h.equipe = { papel: "editor" }
    h.premiadosFalha = true
    montar()
    await waitFor(() => expect(screen.getByTestId("estado").textContent).toBe("pronto"))
    expect(dados()).toBe("grupo|false|true|editor")
  })

  it("falha de leitura vira erro (não 'sem acesso') e 'recarregar' tenta de novo", async () => {
    h.erro = true
    montar()
    await waitFor(() => expect(screen.getByTestId("estado").textContent).toBe("erro"))
    h.erro = false
    h.grupo = true
    await userEvent.click(screen.getByRole("button", { name: "de novo" }))
    await waitFor(() => expect(dados()).toBe("grupo|false|false|null"))
  })
})

describe("temNivel", () => {
  it("compara pela ordem visitante < clube < grupo", () => {
    expect(temNivel("grupo", "clube")).toBe(true)
    expect(temNivel("clube", "grupo")).toBe(false)
    expect(temNivel("visitante", "clube")).toBe(false)
  })
})
