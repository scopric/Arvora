import { describe, expect, it } from "vitest"
import { CODIGOS_PAISES, paisesOrdenados } from "./paises"

describe("paises", () => {
  it("249 códigos únicos e todos conhecidos pelo Intl", () => {
    expect(CODIGOS_PAISES).toHaveLength(249)
    expect(new Set(CODIGOS_PAISES).size).toBe(249)
    const nomes = new Intl.DisplayNames(["pt"], { type: "region" })
    expect(CODIGOS_PAISES.filter((c) => !/^[A-Z]{2}$/.test(c) || nomes.of(c) === c)).toEqual([])
  })
  it("IE vira Irlanda em pt e Ireland em en; lista em ordem do idioma", () => {
    expect(paisesOrdenados("pt").find((p) => p.codigo === "IE")?.nome).toBe("Irlanda")
    expect(paisesOrdenados("en").find((p) => p.codigo === "IE")?.nome).toBe("Ireland")
    const nomes = paisesOrdenados("pt").map((p) => p.nome)
    expect(nomes).toEqual([...nomes].sort((a, b) => a.localeCompare(b, "pt")))
  })
})
