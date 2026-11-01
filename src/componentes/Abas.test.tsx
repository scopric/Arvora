import { cleanup, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"
import { renderiza } from "../testeUtil"
import { Abas } from "./Abas"

afterEach(cleanup)
const abas = [
  { chave: "a", rotulo: "Aulas", conteudo: <p>conteúdo A</p> },
  { chave: "b", rotulo: "Academy", conteudo: <p>conteúdo B</p> },
  { chave: "c", rotulo: "Bem-Estar", conteudo: <p>conteúdo C</p> },
]
const montar = () => renderiza(<Abas abas={abas} rotulo="Aprender" />)

describe("Abas", () => {
  it("mostra só o painel da aba ativa e só ela entra na ordem de tab", () => {
    montar()
    expect(screen.getByRole("tab", { name: "Aulas" })).toHaveProperty("tabIndex", 0)
    expect(screen.getByRole("tab", { name: "Academy" })).toHaveProperty("tabIndex", -1)
    expect(screen.getByText("conteúdo A")).toBeTruthy()
    expect(screen.queryByText("conteúdo B")).toBeNull()
  })

  it("setas, Home e End movem e ativam a aba, com foco", async () => {
    montar()
    const u = userEvent.setup()
    await u.tab()
    await u.keyboard("{ArrowRight}")
    expect(screen.getByRole("tab", { name: "Academy" }).getAttribute("aria-selected")).toBe("true")
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Academy" }))
    expect(screen.getByText("conteúdo B")).toBeTruthy()
    await u.keyboard("{ArrowRight}{ArrowRight}") // dá a volta
    expect(screen.getByRole("tab", { name: "Aulas" }).getAttribute("aria-selected")).toBe("true")
    await u.keyboard("{End}")
    expect(screen.getByRole("tab", { name: "Bem-Estar" }).getAttribute("aria-selected")).toBe("true")
    await u.keyboard("{Home}")
    expect(screen.getByRole("tab", { name: "Aulas" }).getAttribute("aria-selected")).toBe("true")
  })
})
