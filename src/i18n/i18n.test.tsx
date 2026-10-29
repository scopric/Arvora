import { cleanup, render, screen } from "@testing-library/react"
import { MemoryRouter, useLocation } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../lib/sessao", () => ({ useAuth: () => ({ sessao: null, carregando: false }) }))
vi.mock("../lib/supabase", () => ({ supabase: {} }))

import { Rotas } from "../App"
import { en } from "./en"
import { pt } from "./pt"

function Local() {
  const { pathname, search, hash } = useLocation()
  return <p data-testid="local">{pathname + search + hash}</p>
}

const ir = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Rotas />
      <Local />
    </MemoryRouter>,
  )
const local = () => screen.getByTestId("local").textContent

function navegador(langs: string[]) {
  vi.spyOn(navigator, "languages", "get").mockReturnValue(langs)
}

beforeEach(() => localStorage.clear())
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("dicionários", () => {
  it("pt e en têm as mesmas chaves e nenhum valor vazio", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(pt).sort())
    for (const d of [pt, en]) for (const v of Object.values(d)) expect(v.trim()).not.toBe("")
  })
})

describe("rotas com idioma", () => {
  it("/pt e /en mostram textos diferentes na home", () => {
    ir("/pt")
    expect(screen.getByText(pt["inicio.embreve"])).toBeTruthy()
    cleanup()
    ir("/en")
    expect(screen.getByText(en["inicio.embreve"])).toBeTruthy()
    expect(document.documentElement.lang).toBe("en")
  })

  it("sem prefixo segue o navegador", () => {
    navegador(["en-US"])
    ir("/entrar")
    expect(local()).toBe("/en/entrar")
    cleanup()
    localStorage.clear()
    navegador(["pt-BR"])
    ir("/entrar")
    expect(local()).toBe("/pt/entrar")
  })

  it("o idioma salvo vence o navegador", () => {
    navegador(["en-US"])
    localStorage.setItem("arvora.idioma", "pt")
    ir("/cadastro")
    expect(local()).toBe("/pt/cadastro")
  })

  it("preserva search e hash no redirect", () => {
    navegador(["en-US"])
    ir("/redefinir-senha?a=1#access_token=xyz&type=recovery")
    expect(local()).toBe("/en/redefinir-senha?a=1#access_token=xyz&type=recovery")
  })

  it("idioma inválido vai para o padrão mantendo o resto", () => {
    navegador(["pt-BR"])
    ir("/xx/entrar?a=1")
    expect(local()).toBe("/pt/entrar?a=1")
  })

  it("idioma inválido também preserva o hash do link de recuperação", () => {
    navegador(["en-US"])
    ir("/xx/redefinir-senha#access_token=xyz&type=recovery")
    expect(local()).toBe("/en/redefinir-senha#access_token=xyz&type=recovery")
  })

  it("título e lang acompanham o idioma, inclusive ao voltar para pt", () => {
    ir("/en")
    expect(document.documentElement.lang).toBe("en")
    expect(document.title).toBe(en["doc.titulo"])
    cleanup()
    ir("/pt")
    expect(document.documentElement.lang).toBe("pt-BR")
    expect(document.title).toBe(pt["doc.titulo"])
  })

  it("o seletor troca só o prefixo", () => {
    ir("/pt?a=1")
    expect(screen.getByRole("link", { name: "English" }).getAttribute("href")).toBe("/en?a=1")
  })
})

describe("seletor na home", () => {
  it("marca o idioma atual e troca só o prefixo", () => {
    ir("/pt")
    expect(screen.getByRole("link", { name: "Português" }).getAttribute("aria-current")).toBe("true")
    expect(screen.getByRole("link", { name: "English" }).getAttribute("href")).toBe("/en")
    expect(screen.getByRole("navigation", { name: pt["idioma.rotulo"] })).toBeTruthy()
  })
})
