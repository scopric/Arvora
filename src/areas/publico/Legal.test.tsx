import { cleanup, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../../lib/supabase", async () => (await import("./supabaseFalso")).moduloFalso)
vi.mock("../../lib/sessao", async () => (await import("./supabaseFalso")).moduloSessao)

import { montar } from "./montar"
import { falso, zerar } from "./supabaseFalso"
import { Legal } from "./telas/Legal"
import { Suporte } from "./telas/Suporte"

beforeEach(zerar)
afterEach(cleanup)
const ver = (url = "/pt/termos") => montar(<Legal tipo="termos" titulo="publico.termos.titulo" />, "/:lang/termos", url)

describe("Legal", () => {
  it("mostra o texto vigente com versão, escapando HTML", async () => {
    falso.tabelas.documentos_legais = { data: [{ titulo: "T", versao: "v1", vigente_desde: "2026-01-02T00:00:00Z", conteudo_md: "# Regras\n\n<b>x</b>" }], error: null }
    ver()
    expect(await screen.findByRole("heading", { level: 2, name: "Regras" })).toBeTruthy()
    expect(screen.getByText(/Versão v1/)).toBeTruthy()
    expect(screen.getByText("<b>x</b>")).toBeTruthy()
    const eq = falso.chamadas.filter((c) => c.op === "eq").map((c) => c.args.join("="))
    expect(eq).toEqual(["tipo=termos", "idioma=pt"])
  })

  it("sem documento: aviso 'em revisão'; erro: botão de tentar de novo", async () => {
    falso.tabelas.documentos_legais = { data: [], error: null }
    ver("/en/termos")
    expect(await screen.findByText(/under review/)).toBeTruthy()
    cleanup()
    falso.tabelas.documentos_legais = { data: null, error: { message: "x" } }
    ver()
    expect(await screen.findByRole("button", { name: "Tentar de novo" })).toBeTruthy()
  })
})

describe("Suporte", () => {
  it("com e-mail válido mostra o link; sem ou inválido, o aviso de canal em definição", () => {
    montar(<Suporte email="suporte@exemplo.invalid" />, "/:lang/suporte", "/pt/suporte")
    expect(screen.getByRole("link", { name: /suporte@exemplo.invalid/ }).getAttribute("href")).toBe("mailto:suporte@exemplo.invalid")
    cleanup()
    for (const email of [undefined, "isto não é e-mail", 'a@b.c"><x']) {
      montar(<Suporte email={email} />, "/:lang/suporte", "/pt/suporte")
      expect(screen.getByRole("alert").textContent).toMatch(/em definição/)
      expect(screen.queryByRole("link", { name: /mailto/ })).toBeNull()
      cleanup()
    }
  })
})
