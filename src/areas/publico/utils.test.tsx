import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { Markdown } from "./Markdown"
import { criarSlug } from "./slug"

afterEach(cleanup)

describe("Markdown", () => {
  it("renderiza títulos, parágrafos, listas e links seguros", () => {
    render(<Markdown texto={"# Título\n\nLinha um\ncontinua **forte** e *ênfase*.\n\n- a\n- b\n\n1. um\n2. dois\n\n[ok](https://exemplo.invalid/x) e [rel](/pt/termos)"} />)
    expect(screen.getByRole("heading", { level: 2, name: "Título" })).toBeTruthy()
    expect(screen.getAllByRole("list")).toHaveLength(2)
    expect(screen.getAllByRole("listitem")).toHaveLength(4)
    expect(screen.getByText("forte").tagName).toBe("STRONG")
    expect(screen.getByRole("link", { name: "ok" }).getAttribute("href")).toBe("https://exemplo.invalid/x")
    expect(screen.getByRole("link", { name: "rel" }).getAttribute("href")).toBe("/pt/termos")
  })

  it("escapa HTML e recusa link perigoso (javascript:, data:, //host)", () => {
    const { container } = render(<Markdown texto={'<script>alert(1)</script> <img src=x onerror=alert(1)>\n\n[a](javascript:alert) [b](data:text/html,x) [c](//evil.invalid)'} />)
    expect(container.querySelector("script")).toBeNull()
    expect(container.querySelector("img")).toBeNull()
    expect(container.textContent).toContain("<script>alert(1)</script>")
    expect(container.querySelector("a")).toBeNull()
    expect(container.textContent).toContain("a b c")
  })
})

describe("Markdown: links, listas e entidades", () => {
  it("recusa barra invertida em qualquer posição e //host", () => {
    const { container } = render(<Markdown texto={"[a](/\\evil.com) [b](/\\/evil.com) [c](/ok\\x) [d](https://exemplo.invalid/a\\b) [e](//evil.com) [f](/pt/termos)"} />)
    const links = [...container.querySelectorAll("a")]
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/pt/termos"])
  })

  it("lista numerada começa no número do texto e tem start", () => {
    const { container } = render(<Markdown texto={"3. três\n4. quatro"} />)
    expect(container.querySelector("ol")?.getAttribute("start")).toBe("3")
    expect(container.querySelectorAll("li")).toHaveLength(2)
  })

  it("linha em branco entre itens não fecha a lista; linha indentada continua o item", () => {
    const { container } = render(<Markdown texto={"- um\n\n- dois\n  continua aqui\n\nParágrafo depois"} />)
    expect(container.querySelectorAll("ul")).toHaveLength(1)
    const itens = [...container.querySelectorAll("li")].map((l) => l.textContent)
    expect(itens).toEqual(["um", "dois continua aqui"])
    expect(container.querySelector("p")?.textContent).toBe("Parágrafo depois")
  })

  it("decodifica &amp; &nbsp; &lt; &gt; &quot; como texto, sem virar HTML nem decodificar duas vezes", () => {
    const { container } = render(<Markdown texto={"Ana &amp; Cia&nbsp;Ltda &lt;b&gt;x&lt;/b&gt; &quot;oi&quot; &amp;lt;"} />)
    expect(container.querySelector("b")).toBeNull()
    expect(container.textContent).toBe("Ana & Cia\u00a0Ltda <b>x</b> \"oi\" &lt;")
  })
})

describe("criarSlug", () => {
  it("tira acento e símbolo, respeita o formato do banco e muda a cada chamada", () => {
    const a = criarSlug("Açaí & Cia. Ltda!")
    expect(a).toMatch(/^acai-cia-ltda-[0-9a-f]{6}$/)
    expect(criarSlug("Açaí & Cia. Ltda!")).not.toBe(a)
    expect(criarSlug("!!!")).toMatch(/^empresa-[0-9a-f]{6}$/)
    expect(criarSlug("x".repeat(300)).length).toBeLessThanOrEqual(100)
    expect(a).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })
})
