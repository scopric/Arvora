import { cleanup, render, screen } from "@testing-library/react"
import axe from "axe-core"
import { createRoutesStub, MemoryRouter } from "react-router"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("./lib/sessao", () => ({ useAuth: () => ({ sessao: null, carregando: false }) }))
vi.mock("./lib/supabase", () => ({ supabase: { auth: {} } }))

import { Rotas } from "./App"
import { BannerCookies } from "./componentes/BannerCookies"
import HallOfFame, { loader as loaderHall } from "./rotas/hall-of-fame"
import Premiado, { loader as loaderPremiado } from "./rotas/premiado"
import premiados from "./dados/premiados-exemplo.json" with { type: "json" }

afterEach(cleanup)

// jsdom não calcula layout nem cor: o contraste é medido no Lighthouse, não aqui.
async function violacoes() {
  const r = await axe.run(document.body, { rules: { "color-contrast": { enabled: false } } })
  return r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target).join(", ")}`)
}

const p = premiados[0]
const telas: [string, () => void][] = [
  ...["pt", "en"].flatMap((l): [string, () => void][] =>
    ["", "/entrar", "/cadastro", "/recuperar-senha"].map((c) => [
      `/${l}${c}`,
      () => render(<MemoryRouter initialEntries={[`/${l}${c}`]}><Rotas /></MemoryRouter>),
    ]),
  ),
  ...["pt", "en"].flatMap((l): [string, () => void][] => [
    [`/${l}/hall-of-fame`, () => {
      const Stub = createRoutesStub([{ path: "/:lang/hall-of-fame", Component: HallOfFame, loader: loaderHall as never }])
      render(<Stub initialEntries={[`/${l}/hall-of-fame`]} />)
    }],
    [`/${l}/hall-of-fame/${p.edicao}/${p.slug}`, () => {
      const Stub = createRoutesStub([{ path: "/:lang/hall-of-fame/:edicao/:slug", Component: Premiado, loader: loaderPremiado as never }])
      render(<Stub initialEntries={[`/${l}/hall-of-fame/${p.edicao}/${p.slug}`]} />)
    }],
  ]),
]

describe("acessibilidade (axe)", () => {
  it.each(telas)("%s sem violações", async (_url, montar) => {
    montar()
    await screen.findByRole("heading", { level: 1 })
    expect(await violacoes()).toEqual([])
  })

  it.each(["pt", "en"])("banner de cookies (%s) sem violações", async (l) => {
    localStorage.clear()
    render(<MemoryRouter initialEntries={[`/${l}`]}><BannerCookies /></MemoryRouter>)
    await screen.findByRole("button", { name: l === "pt" ? "Aceitar" : "Accept" })
    expect(await violacoes()).toEqual([])
  })
})
