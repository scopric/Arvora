import { cleanup, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { act } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const falso = vi.hoisted(() => ({ atual: {} as unknown }))
vi.mock("../../../lib/supabase", () => ({
  supabase: new Proxy({}, { get: (_, k) => (falso.atual as Record<string | symbol, unknown>)[k] }),
}))

import { chamadas, criarFalso, type Resposta } from "../testeSupabase"
import { SalaAoVivo } from "./SalaAoVivo"

const rpc = (r: Resposta) => (falso.atual = criarFalso({ "rpc:link_transmissao": r }))
const montar = (minutosParaOInicio: number, duracao: number | null = 60) =>
  render(
    <MemoryRouter initialEntries={["/pt"]}>
      <SalaAoVivo aulaId={1} inicio={new Date(Date.now() + minutosParaOInicio * 60000).toISOString()} duracaoMin={duracao} />
    </MemoryRouter>,
  )
const consultas = () => chamadas.filter((c) => c.tabela === "rpc").length
const passar = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)))

beforeEach(() => {
  vi.useFakeTimers()
  chamadas.length = 0
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("SalaAoVivo: polling", () => {
  it("para de perguntar quando o link abre", async () => {
    rpc({ data: "https://sala.invalid/x", error: null })
    montar(5)
    await passar(0)
    expect(screen.getByRole("link", { name: /entrar na aula/i })).toBeTruthy()
    await passar(120_000)
    expect(consultas()).toBe(1)
  })
  it("para de perguntar quando o banco diz sem_acesso", async () => {
    rpc({ data: null, error: { message: "sem_acesso", code: "42501" } })
    montar(5)
    await passar(120_000)
    expect(consultas()).toBe(1)
  })
  it("continua tentando enquanto 'ainda_nao_abriu'", async () => {
    rpc({ data: null, error: { message: "ainda_nao_abriu", code: "P0001" } })
    montar(5)
    await passar(65_000)
    expect(consultas()).toBe(3)
  })
  it("com a aba escondida não consulta", async () => {
    rpc({ data: null, error: { message: "ainda_nao_abriu", code: "P0001" } })
    vi.spyOn(document, "hidden", "get").mockReturnValue(true)
    montar(5)
    await passar(120_000)
    expect(consultas()).toBe(0)
  })
  it("depois do fim previsto (início + duração + margem) para de consultar", async () => {
    rpc({ data: null, error: { message: "ainda_nao_abriu", code: "P0001" } })
    montar(-100, 60) // começou há 100 min, dura 60: já passou da margem de 30 min
    await passar(120_000)
    expect(consultas()).toBe(0)
  })
  it("falha de rede (sem código) tem mensagem própria; erro do servidor, a genérica", async () => {
    rpc({ data: null, error: { message: "TypeError: Failed to fetch", code: "" } })
    montar(5)
    await passar(0)
    expect(screen.getByRole("alert").textContent).toMatch(/falar com o servidor/i)
    cleanup()
    rpc({ data: null, error: { message: "boom", code: "XX000" } })
    montar(5)
    await passar(0)
    expect(screen.getByRole("alert").textContent).toMatch(/link indisponível/i)
  })
})
