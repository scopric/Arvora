import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../lib/sessao", () => ({ useAuth: () => ({ sessao: null, carregando: false }) }))
vi.mock("../lib/supabase", () => ({ supabase: {} }))

import { Rotas } from "../App"
import { BannerCookies } from "../componentes/BannerCookies"
import { gravarConsentimento, limparConsentimento } from "../lib/consentimento"

const ir = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <BannerCookies />
      <Rotas />
    </MemoryRouter>,
  )

beforeEach(limparConsentimento)
afterEach(cleanup)

describe("/cookies", () => {
  it.each([["/pt/cookies", "Política de Cookies"], ["/en/cookies", "Cookie Policy"]])("%s existe", (url, titulo) => {
    ir(url)
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(titulo)
  })

  it("'Alterar minha escolha' apaga a escolha e reabre o banner", async () => {
    gravarConsentimento("aceito")
    ir("/pt/cookies")
    expect(screen.queryByRole("region", { name: "Cookies" })).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "Alterar minha escolha" }))
    expect(localStorage.getItem("arvora.consentimento")).toBeNull()
    expect(await screen.findByRole("region", { name: "Cookies" })).toBeTruthy()
  })

  it("outras rotas continuam 404", () => {
    ir("/pt/cookies-nao")
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Página não encontrada")
  })
})
