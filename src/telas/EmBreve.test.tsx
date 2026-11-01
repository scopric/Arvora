import { cleanup, render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router"
import { afterEach, describe, expect, it, vi } from "vitest"

const estado = vi.hoisted(() => ({ sessao: null as unknown, carregando: false }))
vi.mock("../lib/sessao", () => ({ useAuth: () => ({ sessao: estado.sessao, carregando: estado.carregando }) }))

import { EmBreve } from "./EmBreve"

afterEach(() => {
  cleanup()
  estado.carregando = false
})

const nav = () =>
  render(
    <MemoryRouter initialEntries={["/pt"]}>
      <Routes>
        <Route path="/:lang" element={<EmBreve />} />
      </Routes>
    </MemoryRouter>,
  )

describe("página inicial", () => {
  it("sem sessão, links levam a /entrar e /cadastro", () => {
    estado.sessao = null
    nav()
    expect(screen.getAllByRole("link", { name: "Entrar" })[0]?.getAttribute("href")).toBe("/pt/entrar")
    expect(screen.getAllByRole("link", { name: "Criar conta" })[0]?.getAttribute("href")).toBe("/pt/cadastro")
    expect(screen.queryByRole("link", { name: "Meu perfil" })).toBeNull()
  })

  it("enquanto a sessão carrega, não mostra link nenhum (evita piscar Entrar para quem já está logado)", () => {
    estado.sessao = null
    estado.carregando = true
    nav()
    expect(screen.queryByRole("link", { name: "Entrar" })).toBeNull()
    expect(screen.queryByRole("link", { name: "Criar conta" })).toBeNull()
    expect(screen.queryByRole("link", { name: "Meu perfil" })).toBeNull()
  })

  it("com sessão, mostra o link do perfil no lugar", () => {
    estado.sessao = { user: { id: "u1" } }
    nav()
    expect(screen.getAllByRole("link", { name: "Meu perfil" })[0]?.getAttribute("href")).toBe("/pt/perfil")
    expect(screen.queryByRole("link", { name: "Entrar" })).toBeNull()
  })
})

describe("fundo animado", () => {
  it("a página inicial traz o botão de pausa (cena carrega depois) e o seletor de idioma", async () => {
    estado.sessao = null
    nav()
    expect(await screen.findByRole("button", { name: "Pausar movimento" }, { timeout: 4000 })).toBeTruthy()
    expect(screen.getByRole("link", { name: "EN – English" })).toBeTruthy()
  })
})

describe("conteúdo", () => {
  it("tem um h1, uma seção por frente, as portas, a aula e a chamada para criar conta", () => {
    estado.sessao = null
    nav()
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    for (const n of [1, 2, 3, 4]) expect(document.getElementById(`frente-${n}`)?.tagName).toBe("SECTION")
    expect(screen.getByRole("heading", { level: 2, name: "Do palco à comunidade." })).toBeTruthy()
    expect(document.querySelectorAll("main ol > li")).toHaveLength(7) // 3 portas + 4 materiais
    expect(screen.getAllByRole("link", { name: "Criar conta" }).length).toBeGreaterThanOrEqual(2)
    expect(screen.getByRole("link", { name: "Conhecer o Clube" }).getAttribute("href")).toBe("/pt/planos")
    expect(screen.getByRole("link", { name: "Conhecer o Grupo Árvora" }).getAttribute("href")).toBe("/pt/planos")
  })

  it("chegando com #frente-3 na URL, rola até a seção (o App carrega sob demanda)", () => {
    estado.sessao = null
    const rolar = vi.fn()
    Element.prototype.scrollIntoView = rolar
    render(
      <MemoryRouter initialEntries={["/pt#frente-3"]}>
        <Routes>
          <Route path="/:lang" element={<EmBreve />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(rolar).toHaveBeenCalledTimes(1)
    expect((rolar.mock.contexts[0] as Element).id).toBe("frente-3")
  })

  it("o dourado fica só no Brazilian Awards e na faixa do Hall of Fame", () => {
    estado.sessao = null
    nav()
    const dourados = [...document.querySelectorAll('[class*="dourado"]')]
    expect(dourados.some((e) => e.closest("#frente-1"))).toBe(true)
    expect(dourados.some((e) => e.closest('[aria-labelledby="hof"]'))).toBe(true)
    const fora = dourados.filter((e) => !e.closest("#frente-1") && !e.closest('[aria-labelledby="hof"]'))
    expect(fora).toHaveLength(0)
  })
})
