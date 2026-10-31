import { cleanup, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../../lib/supabase", async () => (await import("./supabaseFalso")).moduloFalso)
vi.mock("../../lib/sessao", async () => (await import("./supabaseFalso")).moduloSessao)

import { montar } from "./montar"
import { falso, zerar } from "./supabaseFalso"
import { Awards } from "./telas/Awards"
import { Evento } from "./telas/Evento"

const base = { id: 1, nome: "Edição Teste", ano: 2026, cidade: "Dublin", pais: "IE", descricao: null, durante_inicio: "2026-11-10T10:00:00Z", durante_fim: "2026-11-10T20:00:00Z", transmissao_url: "https://exemplo.invalid/live", gravacao_video_id: null }
beforeEach(() => {
  zerar()
  falso.tabelas.categorias_premio = { data: [{ id: 1, nome: "Inovação" }], error: null }
  falso.tabelas.indicados = { data: [{ id: 1, categoria_id: 1, nome: "Indicado Um", resumo: null }], error: null }
  falso.tabelas.patrocinadores = { data: [{ id: 1, nome: "Patro", logo_path: null, site: "javascript:x", nivel: "ouro" }], error: null }
  falso.tabelas.agenda_evento = { data: [{ id: 1, inicio_em: "2026-11-10T10:00:00Z", titulo: "Abertura", descricao: null, local: null }], error: null }
  falso.tabelas.premiados = { data: [{ id: 1, nome: "Premiado Um", slug: "p1" }], error: null }
})
afterEach(cleanup)
const ver = (fase: string, acesso = {}) => {
  falso.tabelas.edicoes = { data: [{ ...base, fase }], error: null }
  return montar(<Evento />, "/:lang/evento/:edicao", "/pt/evento/ed-teste", acesso)
}

describe("Evento", () => {
  it("antes: indicados por categoria e patrocinadores; site não-https do patrocinador não vira link", async () => {
    ver("antes")
    expect(await screen.findByText("Indicado Um")).toBeTruthy()
    expect(screen.getByText("Inovação")).toBeTruthy()
    expect(screen.getByText("Patro")).toBeTruthy()
    expect(screen.queryByRole("link", { name: "Patro" })).toBeNull()
    expect(screen.queryByText("Agenda")).toBeNull()
  })
  it("durante: agenda em Dublin e Brasília e link da transmissão", async () => {
    ver("durante")
    expect(await screen.findByText("Abertura")).toBeTruthy()
    expect(screen.getByText(/Dublin 10:00 · Brasília 07:00/)).toBeTruthy()
    expect(screen.getByRole("link", { name: "Assistir à transmissão" }).getAttribute("href")).toBe("https://exemplo.invalid/live")
  })
  it("depois: premiados com link ao Hall of Fame e convite a assinar só para quem não tem plano", async () => {
    ver("depois")
    expect((await screen.findByRole("link", { name: "Premiado Um" })).getAttribute("href")).toBe("/pt/hall-of-fame/ed-teste/p1")
    expect(screen.getByRole("link", { name: "Planos" })).toBeTruthy()
    expect(screen.queryByText("Indicados")).toBeNull()
    cleanup()
    ver("depois", { nivel: "grupo" })
    await screen.findByRole("link", { name: "Premiado Um" })
    expect(screen.queryByRole("link", { name: "Planos" })).toBeNull()
  })
  it("edição inexistente tem tela própria", async () => {
    falso.tabelas.edicoes = { data: [], error: null }
    montar(<Evento />, "/:lang/evento/:edicao", "/pt/evento/x")
    expect(await screen.findByText("Não encontramos esta página")).toBeTruthy()
  })
})

describe("Awards", () => {
  it("7 ambientes; Match com cadeado para o Clube; Hall of Fame é link comum; evento aponta para a edição mais recente", async () => {
    falso.tabelas.edicoes = { data: [{ slug: "ed-teste", nome: "Edição Teste", fase: "antes" }], error: null }
    montar(<Awards />, "/:lang/awards", "/pt/awards", { nivel: "clube" })
    expect(await screen.findAllByRole("heading", { level: 2 })).toHaveLength(7)
    expect(screen.getByRole("link", { name: "Hall of Fame" }).getAttribute("href")).toBe("/pt/hall-of-fame")
    expect(screen.getByText("Incluído no Grupo Árvora")).toBeTruthy()
    expect(screen.queryByText("Incluído no Clube")).toBeNull()
    expect((await screen.findByRole("link", { name: /Evento/ })).getAttribute("href")).toBe("/pt/evento/ed-teste")
  })
})
