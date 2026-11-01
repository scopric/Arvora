import { expect, it } from "vitest"
import { contagem } from "./estilo"

const t = (c: "admin.comum.linha" | "admin.comum.linhas") => (c === "admin.comum.linha" ? "linha" : "linhas")

it("contagem: singular, plural e '+' quando a consulta parou no limite", () => {
  expect(contagem(1, false, t)).toBe("1 linha")
  expect(contagem(12, false, t)).toBe("12 linhas")
  expect(contagem(300, true, t)).toBe("300+ linhas")
})
