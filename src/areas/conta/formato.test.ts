import { describe, expect, it } from "vitest"
import { dataDoDia, prazoArrependimento } from "./formato"

const DIA = 86_400_000

describe("prazo de arrependimento (14 dias)", () => {
  const inicio = "2026-10-01T10:00:00Z"
  const t0 = Date.parse(inicio)
  it("aberto antes dos 14 dias, fechado no instante exato", () => {
    expect(prazoArrependimento(inicio, t0 + 13 * DIA)?.aberto).toBe(true)
    expect(prazoArrependimento(inicio, t0 + 14 * DIA)?.aberto).toBe(false)
    expect(prazoArrependimento(inicio, t0 + 14 * DIA)?.fim).toBe("2026-10-15T10:00:00.000Z")
  })
  it("data inválida não vira prazo (null), em vez de quebrar a tela", () => {
    expect(prazoArrependimento("lixo", t0)).toBeNull()
  })
})

describe("datas", () => {
  it("prazo_em (só data) não escorrega de dia", () => {
    expect(dataDoDia("2026-11-30", "pt")).toBe("30/11/2026")
    expect(dataDoDia("2026-11-30", "en")).toBe("30/11/2026")
  })
})
