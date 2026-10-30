import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router"
import { afterEach, describe, expect, it } from "vitest"
import { en } from "../i18n/en"
import { pt } from "../i18n/pt"
import { gerar } from "./arvoreRede"
import { FundoArvore } from "./FundoArvore"

afterEach(cleanup)

const ver = (lang: string) =>
  render(
    <MemoryRouter initialEntries={[`/${lang}`]}>
      <Routes>
        <Route path="/:lang" element={<FundoArvore />} />
      </Routes>
    </MemoryRouter>,
  )

describe("FundoArvore", () => {
  it("SVG decorativo e número de galhos enxuto", () => {
    const a = ver("pt")
    const svg = a.container.querySelector("svg")!
    expect(svg.getAttribute("focusable")).toBe("false")
    expect(svg.closest("[aria-hidden='true']")).not.toBeNull()
    const paths = a.container.querySelectorAll("path[pathLength]")
    expect(paths.length).toBeGreaterThanOrEqual(40)
    expect(paths.length).toBeLessThanOrEqual(130)
  })

  it("o gerador é determinístico: duas execuções dão exatamente a mesma árvore (semente fixa)", () => {
    const a = gerar(), b = gerar()
    expect(b).toEqual(a)
    expect(a.fios.length).toBeGreaterThan(40)
    expect(a.nos.length).toBeGreaterThan(20)
    expect(a.fios[0].d).toBe("M200.0 600.0Q" + a.fios[0].d.split("Q")[1]) // o tronco sai sempre da base
  })

  it.each([["pt", pt], ["en", en]] as const)("botão de pausa traduzido (%s): o nome troca e data-parado alterna", (lang, d) => {
    const { container } = ver(lang)
    const raiz = container.firstElementChild!
    const botao = screen.getByRole("button", { name: d["fundo.pausar"] })
    expect(botao.hasAttribute("aria-pressed")).toBe(false) // um só sinal: o nome troca
    expect(raiz.hasAttribute("data-parado")).toBe(false)
    fireEvent.click(botao)
    expect(screen.getByRole("button", { name: d["fundo.continuar"] })).toBeTruthy()
    expect(raiz.hasAttribute("data-parado")).toBe(true)
  })

  it("chaves novas existem em pt e en", () => {
    for (const k of ["fundo.pausar", "fundo.continuar"] as const) {
      expect(pt[k]).toBeTruthy()
      expect(en[k]).toBeTruthy()
    }
  })
})
