import { beforeEach, describe, expect, it, vi } from "vitest"

const falso = vi.hoisted(() => ({ atual: {} as unknown }))
vi.mock("../../lib/supabase", () => ({
  supabase: new Proxy({}, { get: (_, k) => (falso.atual as Record<string | symbol, unknown>)[k] }),
}))

import { chamadas, criarFalso } from "./testeSupabase"
import { gerarIcs, gravarProgresso, linkGoogleAgenda, segundaDaSemana, videoDe } from "./util"

const aula = { id: 7, slug: "live-x", titulo: "Live: preço, valor; margem", inicio_em: "2026-11-05T19:00:00Z", duracao_min: 60 }

describe("agenda", () => {
  it(".ics em UTC, com vírgula e ponto e vírgula escapados", () => {
    const ics = gerarIcs(aula, "pt")
    expect(ics).toContain("DTSTART:20261105T190000Z")
    expect(ics).toContain("DTEND:20261105T200000Z")
    expect(ics).toContain("SUMMARY:Live: preço\\, valor\\; margem")
    expect(ics.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true)
  })
  it("título acentuado e muito longo dobra por octetos, sem cortar caractere; quebra de linha vira \\n", () => {
    const ics = gerarIcs({ ...aula, titulo: "Ação é emoção 😀 ".repeat(8) + "\r\nfim\rx" }, "pt")
    const linhas = ics.split("\r\n")
    expect(linhas.every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true)
    expect(ics).not.toContain("\uFFFD")
    expect(ics.replace(/\r\n /g, "")).toContain("😀")
    expect(ics.replace(/\r\n /g, "")).toContain("\\nfim\\nx")
  })
  it("link do Google Agenda leva as datas em UTC", () => {
    expect(linkGoogleAgenda(aula, "pt")).toContain("dates=20261105T190000Z%2F20261105T200000Z")
  })
  it("semana começa na segunda (Dublin)", () => {
    expect(segundaDaSemana("2026-11-05T19:00:00Z")).toBe("2026-11-02")
    expect(segundaDaSemana("2026-11-08T23:30:00Z")).toBe("2026-11-02") // domingo
  })
})

describe("videoDe", () => {
  it("https .mp4/.m3u8 = arquivo; outro https = embed; o resto = indisponível", () => {
    expect(videoDe("https://x.invalid/a.mp4?t=1")?.tipo).toBe("arquivo")
    expect(videoDe("https://x.invalid/a.m3u8")?.tipo).toBe("arquivo")
    expect(videoDe("https://player.invalid/embed/123")?.tipo).toBe("embed")
    expect(videoDe("abc123")).toBeNull()
    expect(videoDe("javascript:alert(1)")).toBeNull()
    expect(videoDe(null)).toBeNull()
  })
})

describe("gravarProgresso", () => {
  beforeEach(() => {
    chamadas.length = 0
  })
  it("atualiza a linha existente e não insere", async () => {
    falso.atual = criarFalso({ "progresso_aula.update": { data: [{ aula_id: 1 }], error: null } })
    expect(await gravarProgresso("u1", 1, 42.6, 90.4)).toBe(true)
    expect(chamadas.map((c) => c.metodo)).toEqual(["update"])
    expect(chamadas[0].args[0]).toEqual({ percentual: 43, posicao_seg: 90 })
  })
  it("UPDATE que não casa linha (primeira vez) cai no INSERT", async () => {
    falso.atual = criarFalso({ "progresso_aula.update": { data: [], error: null }, "progresso_aula.insert": { data: null, error: null } })
    expect(await gravarProgresso("u1", 1, 10, 5)).toBe(true)
    expect(chamadas.map((c) => c.metodo)).toEqual(["update", "insert"])
  })
  it("erro do banco devolve false (a tela mostra o aviso)", async () => {
    falso.atual = criarFalso({ "progresso_aula.update": { data: null, error: { message: "x" } } })
    expect(await gravarProgresso("u1", 1, 10, 5)).toBe(false)
  })
})
