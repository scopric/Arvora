import { cleanup, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { renderiza } from "../testeUtil"
import { Botao } from "./Botao"
import { EscopoApp } from "./escopo"

afterEach(cleanup)
const botao = (nome: string) => screen.getByRole("button", { name: nome })

describe("Botao no escopo do app", () => {
  it("`pequeno` dá o Ghost de 40px, não o botão de 48px", () => {
    renderiza(<EscopoApp value><Botao pequeno>Conectar</Botao></EscopoApp>)
    const b = botao("Conectar")
    expect(b.classList.contains("min-h-10")).toBe(true)
    expect(b.classList.contains("min-h-12")).toBe(false)
  })

  it("`pequeno` com variante perigo fica vermelho", () => {
    renderiza(<EscopoApp value><Botao pequeno variante="perigo">Remover</Botao></EscopoApp>)
    const b = botao("Remover")
    expect(b.classList.contains("text-red-300")).toBe(true)
    expect(b.classList.contains("border-red-300/60")).toBe(true)
    expect(b.classList.contains("min-h-10")).toBe(true)
    // A cor vem só da variante: nada do creme do Ghost comum fica junto para disputar a cascata.
    expect(b.classList.contains("text-creme")).toBe(false)
    expect(b.classList.contains("border-creme/40")).toBe(false)
  })

  it("`pequeno` ignora as outras variantes: secundario e contorno saem iguais ao Ghost comum", () => {
    renderiza(<EscopoApp value><Botao pequeno>a</Botao><Botao pequeno variante="secundario">b</Botao><Botao pequeno variante="contorno">c</Botao></EscopoApp>)
    expect(botao("b").className).toBe(botao("a").className)
    expect(botao("c").className).toBe(botao("a").className)
  })

  it("`ocupado` troca o texto por Aguarde…, marca aria-busy e desabilita", () => {
    renderiza(<EscopoApp value><Botao ocupado>Salvar</Botao></EscopoApp>)
    const b = botao("Aguarde…")
    expect(screen.queryByText("Salvar")).toBeNull()
    expect(b.getAttribute("aria-busy")).toBe("true")
    expect(b).toHaveProperty("disabled", true)
  })
})

describe("Botao no público", () => {
  it("`pequeno` vira contorno: traço, sem o fundo de destaque", () => {
    renderiza(<Botao pequeno>Ver mais</Botao>)
    const b = botao("Ver mais")
    expect(b.classList.contains("border")).toBe(true)
    expect(b.classList.contains("bg-destaque")).toBe(false)
  })

  it("variante secundario é o próprio contorno", () => {
    renderiza(<><Botao variante="secundario">a</Botao><Botao variante="contorno">b</Botao></>)
    expect(botao("a").className).toBe(botao("b").className)
    expect(botao("a").classList.contains("border")).toBe(true)
  })
})
