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
    expect(screen.getByRole("link", { name: "Entrar" }).getAttribute("href")).toBe("/pt/entrar")
    expect(screen.getByRole("link", { name: "Criar conta" }).getAttribute("href")).toBe("/pt/cadastro")
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
    expect(screen.getByRole("link", { name: "Meu perfil" }).getAttribute("href")).toBe("/pt/perfil")
    expect(screen.queryByRole("link", { name: "Entrar" })).toBeNull()
  })
})

describe("fundo animado", () => {
  it("a página inicial traz o botão de pausa e o seletor de idioma", () => {
    estado.sessao = null
    nav()
    expect(screen.getByRole("button", { name: "Pausar movimento" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "English" })).toBeTruthy()
  })
})
