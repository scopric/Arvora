import { cleanup, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../../lib/supabase", async () => (await import("./supabaseFalso")).moduloFalso)
vi.mock("../../lib/sessao", async () => (await import("./supabaseFalso")).moduloSessao)

import { montar } from "./montar"
import { estado, falso, zerar } from "./supabaseFalso"
import { Awards } from "./telas/Awards"
import { MemoryRouter, Route, Routes, useParams } from "react-router"
import { render } from "@testing-library/react"
import { Evento, EventoAtual } from "./telas/Evento"

const base = { id: 1, nome: "Edição Teste", cidade: "Dublin", pais: "IE", descricao: null, durante_inicio: "2026-11-10T10:00:00Z" }
beforeEach(() => {
  zerar()
  estado.sessao = null
  falso.tabelas.edicoes = { data: [{ transmissao_url: "https://exemplo.invalid/live", gravacao_video_id: "https://exemplo.invalid/grav" }], error: null }
  falso.tabelas.categorias_premio = { data: [{ id: 1, nome: "Inovação" }], error: null }
  falso.tabelas.indicados = { data: [{ id: 1, categoria_id: 1, nome: "Indicado Um", resumo: null }], error: null }
  falso.tabelas.patrocinadores = { data: [{ id: 1, nome: "Patro", logo_path: null, site: "javascript:x", nivel: "ouro" }], error: null }
  falso.tabelas.agenda_evento = { data: [{ id: 1, inicio_em: "2026-11-10T10:00:00Z", titulo: "Abertura", descricao: null, local: null }], error: null }
  falso.tabelas.premiados = { data: [{ id: 1, nome: "Premiado Um", slug: "p1" }], error: null }
})
afterEach(cleanup)
const ver = (fase: string, acesso = {}) => {
  falso.tabelas.edicoes_publicas = { data: [{ ...base, fase }], error: null }
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
  it("durante: agenda em Dublin e Brasília; link da transmissão só com sessão", async () => {
    ver("durante")
    expect(await screen.findByText("Abertura")).toBeTruthy()
    expect(screen.queryByRole("link", { name: "Assistir à transmissão" })).toBeNull()
    cleanup()
    estado.sessao = { user: { id: "u1", email: "a@b.invalid" } }
    ver("durante")
    expect(await screen.findByText("Abertura")).toBeTruthy()
    expect(screen.getByText(/Dublin 10:00 · Brasília 07:00/)).toBeTruthy()
    expect(screen.getByRole("link", { name: "Assistir à transmissão" }).getAttribute("href")).toBe("https://exemplo.invalid/live")
  })
  it("depois: premiados com link ao Hall of Fame e convite a assinar só para quem não tem plano", async () => {
    estado.sessao = { user: { id: "u1", email: "a@b.invalid" } }
    ver("depois")
    expect(document.querySelector("iframe")).toBeNull()
    await vi.waitFor(() => expect(document.querySelector("iframe")?.getAttribute("src")).toBe("https://exemplo.invalid/grav"))
    expect((await screen.findByRole("link", { name: "Premiado Um" })).getAttribute("href")).toBe("/pt/hall-of-fame/ed-teste/p1")
    expect(screen.getByRole("link", { name: "Planos" })).toBeTruthy()
    expect(screen.queryByText("Indicados")).toBeNull()
    cleanup()
    ver("depois", { nivel: "grupo" })
    await screen.findByRole("link", { name: "Premiado Um" })
    expect(screen.queryByRole("link", { name: "Planos" })).toBeNull()
  })
  it("cidade e país vazios não deixam vírgula solta; título da aba leva o nome da edição", async () => {
    falso.tabelas.edicoes_publicas = { data: [{ ...base, cidade: null, pais: null, fase: "antes" }], error: null }
    montar(<Evento />, "/:lang/evento/:edicao", "/pt/evento/ed-teste")
    await screen.findByText("Indicado Um")
    expect(screen.getByText(/Antes do evento/).textContent).not.toMatch(/,|null|undefined/)
    await vi.waitFor(() => expect(document.title).toBe("Edição Teste — Grupo Árvora"))
  })
  it("edição inexistente tem tela própria", async () => {
    falso.tabelas.edicoes_publicas = { data: [], error: null }
    montar(<Evento />, "/:lang/evento/:edicao", "/pt/evento/x")
    expect(await screen.findByText("Não encontramos esta página")).toBeTruthy()
  })
})

function Destino() {
  const { lang, edicao } = useParams()
  return <p>destino: /{lang}/evento/{edicao}</p>
}
describe("Evento atual (/evento)", () => {
  afterEach(() => vi.useRealTimers())
  const abrir = () =>
    render(
      <MemoryRouter initialEntries={["/pt/evento"]}>
        <Routes>
          <Route path="/:lang/evento" element={<EventoAtual />} />
          <Route path="/:lang/evento/:edicao" element={<Destino />} />
        </Routes>
      </MemoryRouter>,
    )
  const ed = (slug: string, fim: string) => ({ slug, durante_fim: fim })
  it("vai para a próxima edição (ou a em curso), não para a que já passou nem para a mais distante", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-03T12:00:00Z") })
    falso.tabelas.edicoes_publicas = { data: [ed("dublin-2025", "2025-11-12T20:00:00Z"), ed("dublin-2026", "2026-11-12T20:00:00Z"), ed("dublin-2027", "2027-11-12T20:00:00Z")], error: null }
    abrir()
    expect(await screen.findByText("destino: /pt/evento/dublin-2026")).toBeTruthy()
    expect(falso.chamadas.some((c) => c.tabela === "edicoes_publicas" && c.op === "not" && c.args[0] === "publicada_em")).toBe(true)
    // O falso não ordena: o find/at(-1) só acerta no banco real se a lista vier em ordem crescente de início.
    const ordem = falso.chamadas.filter((c) => c.tabela === "edicoes_publicas" && c.op === "order")
    expect(ordem).toHaveLength(1)
    expect(ordem[0].args[0]).toBe("durante_inicio")
    expect((ordem[0].args[1] as { ascending?: boolean } | undefined)?.ascending).not.toBe(false)
  })
  it("sem edição futura, a mais recente que já passou", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-03T12:00:00Z") })
    falso.tabelas.edicoes_publicas = { data: [ed("edicao-qa", "2024-05-01T20:00:00Z"), ed("exemplo-dublin-2025", "2025-11-12T20:00:00Z")], error: null }
    abrir()
    expect(await screen.findByText("destino: /pt/evento/exemplo-dublin-2025")).toBeTruthy()
  })
  it("sem edição publicada, em breve", async () => {
    falso.tabelas.edicoes_publicas = { data: [], error: null }
    abrir()
    expect(await screen.findByText("Em breve.")).toBeTruthy()
    expect(screen.getByRole("heading", { level: 1, name: "Evento" })).toBeTruthy()
  })
})

describe("Awards", () => {
  it("7 ambientes; Match com cadeado para o Clube; Hall of Fame é link comum; evento aponta para a edição mais recente", async () => {
    falso.tabelas.edicoes_publicas = { data: [{ slug: "ed-teste", nome: "Edição Teste", fase: "antes" }], error: null }
    montar(<Awards />, "/:lang/awards", "/pt/awards", { nivel: "clube" })
    expect(await screen.findAllByRole("heading", { level: 2 })).toHaveLength(7)
    expect(screen.getByRole("link", { name: "Hall of Fame" }).getAttribute("href")).toBe("/pt/hall-of-fame")
    expect(screen.getByText("Incluído no Grupo Árvora")).toBeTruthy()
    expect(screen.queryByText("Incluído no Clube")).toBeNull()
    expect((await screen.findByRole("link", { name: /Evento/ })).getAttribute("href")).toBe("/pt/evento/ed-teste")
    expect(falso.chamadas.some((c) => c.tabela === "edicoes_publicas" && c.op === "not" && c.args[0] === "publicada_em")).toBe(true)
  })
})
