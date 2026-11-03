import { cleanup, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { renderiza } from "../testeUtil"
import { LinkVoltar } from "./LinkVoltar"

afterEach(cleanup)

describe("LinkVoltar", () => {
  it("é um link para o destino recebido, com o rótulo como nome e a seta só decorativa", () => {
    renderiza(<LinkVoltar para="/pt/rede" rotulo="Voltar para a rede" />)
    const link = screen.getByRole("link", { name: "Voltar para a rede" })
    expect(link.getAttribute("href")).toBe("/pt/rede")
    const seta = link.querySelector("svg")
    expect(seta).not.toBeNull()
    expect(seta?.getAttribute("aria-hidden")).toBe("true")
  })
})
