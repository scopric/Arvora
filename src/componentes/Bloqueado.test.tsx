import { cleanup, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { renderiza } from "../testeUtil"
import { Bloqueado } from "./Bloqueado"

afterEach(cleanup)
const montar = (lang: string, minimo?: "clube" | "grupo") =>
  renderiza(
    <Bloqueado previa={<h2>Aula 12: fechando a venda</h2>} frase="As aulas semanais fazem parte do Grupo Árvora." minimo={minimo} />,
    `/${lang}/aulas`,
  )

describe("Bloqueado", () => {
  it("prévia borrada fica fora da leitura de tela; frase e botão de upgrade apontam para /planos no idioma", () => {
    montar("pt")
    const previa = screen.getByText("Aula 12: fechando a venda")
    expect(previa.closest("[aria-hidden='true']")).not.toBeNull()
    expect(screen.queryByRole("heading", { name: "Aula 12: fechando a venda" })).toBeNull() // aria-hidden: não aparece como título
    expect(screen.getByText("Bloqueado: parte do Grupo Árvora")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Conhecer o Grupo" }).getAttribute("href")).toBe("/pt/planos")
  })

  it("rótulo e botão mudam para o Clube e para o inglês", () => {
    montar("en", "clube")
    expect(screen.getByText("Locked: part of the Club")).toBeTruthy()
    expect(screen.getByRole("link", { name: "See the plans" }).getAttribute("href")).toBe("/en/planos")
  })
})
