import { cleanup, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../../lib/supabase", async () => (await import("./supabaseFalso")).moduloFalso)
vi.mock("../../lib/sessao", async () => (await import("./supabaseFalso")).moduloSessao)

import { PaginaVideo } from "./componentes/PaginaVideo"
import { montar } from "./montar"
import { estado, falso, zerar } from "./supabaseFalso"

const video = { id: 7, titulo: "Talk de teste", descricao: "d", duracao_min: 12, nivel_minimo: "clube", trailer_video_id: "https://exemplo.invalid/trailer" }
beforeEach(() => {
  zerar()
  estado.sessao = null
  falso.tabelas.videos = { data: [video], error: null }
  falso.tabelas.videos_citados = { data: [
    { id: 1, premiados: { nome: "Pessoa Exemplo", slug: "pessoa", edicoes: { slug: "ed-2025" } }, empresas: null },
    { id: 2, premiados: null, empresas: { nome: "Empresa Exemplo", slug: "empresa" } },
  ], error: null }
  falso.tabelas.salvos = { data: [], error: null }
})
afterEach(cleanup)
const ver = (acesso = {}) => montar(<PaginaVideo tipo="talk" base="/biblioteca" titulo="publico.bibliotecaVideo.titulo" />, "/:lang/biblioteca/:slug", "/pt/biblioteca/talk-teste", acesso)

describe("PaginaVideo", () => {
  it("visitante: só o trecho e o cadeado; nunca pede video_id nem chama a RPC", async () => {
    ver()
    expect(await screen.findByRole("heading", { level: 1, name: "Talk de teste" })).toBeTruthy()
    await waitFor(() => expect(document.title).toBe("Talk de teste — Grupo Árvora"))
    expect(document.querySelector("iframe")?.getAttribute("src")).toBe("https://exemplo.invalid/trailer")
    expect(screen.getByText("O restante deste vídeo está no Clube.")).toBeTruthy()
    expect(falso.rpc).not.toHaveBeenCalled()
    expect(JSON.stringify(falso.chamadas.filter((c) => c.tabela === "videos"))).not.toMatch(/[",]video_id/)
    expect(screen.queryByRole("button", { name: "Salvar" })).toBeNull()
  })

  it("quem aparece: Hall of Fame por <a> com a edição e Directory por Link", async () => {
    ver()
    expect((await screen.findByRole("link", { name: "Pessoa Exemplo" })).getAttribute("href")).toBe("/pt/hall-of-fame/ed-2025/pessoa")
    expect(screen.getByRole("link", { name: "Empresa Exemplo" }).getAttribute("href")).toBe("/pt/directory/empresa")
  })

  it("membro com nível: pega o vídeo pela RPC video_do_video; RPC com erro = vídeo indisponível; id não-https também", async () => {
    estado.sessao = { user: { id: "u1", email: "a@b.invalid" } }
    falso.rpc.mockResolvedValue({ data: "https://exemplo.invalid/video", error: null })
    ver({ nivel: "clube" })
    await waitFor(() => expect(document.querySelector("iframe")?.getAttribute("src")).toBe("https://exemplo.invalid/video"))
    expect(falso.rpc).toHaveBeenCalledWith("video_do_video", { p_video: 7 })
    cleanup()
    falso.rpc.mockResolvedValue({ data: null, error: { message: "sem_acesso" } })
    ver({ nivel: "clube" })
    expect(await screen.findByText(/Não conseguimos abrir este vídeo/)).toBeTruthy()
    cleanup()
    falso.rpc.mockResolvedValue({ data: "video-123", error: null })
    ver({ nivel: "clube" })
    expect(await screen.findByText(/Não conseguimos abrir este vídeo/)).toBeTruthy()
    expect(document.querySelector("iframe")).toBeNull()
  })

  it("salvar insere {video_id}; resposta vazia do banco é erro, não sucesso", async () => {
    estado.sessao = { user: { id: "u1", email: "a@b.invalid" } }
    falso.rpc.mockResolvedValue({ data: "https://exemplo.invalid/video", error: null })
    falso.tabelas.salvos = (op) => (op === "insert" ? { data: [], error: null } : { data: [], error: null })
    ver({ nivel: "clube" })
    await userEvent.click(await screen.findByRole("button", { name: "Salvar" }))
    expect(await screen.findByText(/Não conseguimos salvar/)).toBeTruthy()
    expect(falso.chamadas.find((c) => c.op === "insert")?.args).toEqual([{ video_id: 7 }])
    falso.tabelas.salvos = (op) => (op === "insert" ? { data: [{ id: 9 }], error: null } : { data: [], error: null })
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }))
    expect(await screen.findByRole("button", { name: "Salvo" })).toBeTruthy()
  })

  it("slug inexistente e erro de leitura têm tela própria", async () => {
    falso.tabelas.videos = { data: [], error: null }
    ver()
    expect(await screen.findByText("Não encontramos esta página")).toBeTruthy()
    await waitFor(() => expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex"))
    cleanup()
    falso.tabelas.videos = { data: null, error: { message: "x" } }
    ver()
    expect(await screen.findByRole("button", { name: "Tentar de novo" })).toBeTruthy()
  })
})
