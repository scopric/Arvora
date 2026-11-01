import { beforeEach, describe, expect, it, vi } from "vitest"

const upload = vi.hoisted(() => vi.fn())
const createSignedUrl = vi.hoisted(() => vi.fn())
vi.mock("../../../lib/supabase", () => ({ supabase: { storage: { from: () => ({ upload, createSignedUrl }) } } }))

import { abrirAssinado, enviarArquivo } from "../lib/consulta"

beforeEach(() => {
  upload.mockReset().mockResolvedValue({ error: null })
  createSignedUrl.mockReset().mockResolvedValue({ data: { signedUrl: "https://exemplo.invalid/x" }, error: null })
  vi.stubGlobal("open", vi.fn())
})

describe("arquivos do admin", () => {
  it("nome aleatório: o nome original não vai para o bucket, só a extensão", async () => {
    const caminho = await enviarArquivo("imagens", "premiados", new File(["x"], "Maria Silva — foto.JPG"))
    expect(caminho).toMatch(/^premiados\/[0-9a-f-]{36}\.jpg$/)
    expect(caminho).not.toMatch(/maria|silva/i)
    expect(await enviarArquivo("imagens", "p", new File(["x"], "sem-extensao"))).toMatch(/^p\/[0-9a-f-]{36}$/)
  })

  it("abre sempre como download", async () => {
    await abrirAssinado("entregas", "u/a.pdf")
    expect(createSignedUrl).toHaveBeenCalledWith("u/a.pdf", 300, { download: true })
  })
})
