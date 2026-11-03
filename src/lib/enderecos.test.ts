import { describe, expect, it } from "vitest"
import { caminhoInterno, ehAppSeparado, ehPainel, enderecoCerto, inicioDepoisDoLogin, linkSite } from "./enderecos"

const S = "https://www.x.com", A = "https://app.x.com", P = "https://alpha.x.com"
const sites = { site: S, app: A, admin: P }
const ir = (origem: string, caminho: string) => enderecoCerto(origem, caminho, sites)

describe("enderecoCerto", () => {
  it("site manda membro para o app e admin para o painel", () => {
    expect(ir(S, "/pt/entrar")).toBe(`${A}/pt/entrar`)
    expect(ir(S, "/en/aulas/x")).toBe(`${A}/en/aulas/x`)
    expect(ir(S, "/pt/admin/aulas")).toBe(`${P}/pt/admin/aulas`)
    expect(ir(S, "/pt/hall-of-fame")).toBeNull()
    expect(ir(S, "/pt")).toBeNull()
    expect(ir(S, "/pt/biblioteca/x")).toBeNull()
  })
  it("app devolve o público ao site e abre no Início", () => {
    expect(ir(A, "/pt/termos")).toBe(`${S}/pt/termos`)
    expect(ir(A, "/pt/inicio")).toBeNull()
    expect(ir(A, "/pt")).toBe(`${A}/pt/inicio`)
    expect(ir(A, "/pt/admin")).toBe(`${P}/pt/admin`)
    expect(ir(A, "/pt/biblioteca/x")).toBeNull()
    expect(ir(A, "/pt/planos")).toBeNull()
  })
  it("painel só tem admin e entrar", () => {
    expect(ir(P, "/pt/admin")).toBeNull()
    expect(ir(P, "/pt/entrar")).toBeNull()
    expect(ir(P, "/pt/inicio")).toBe(`${A}/pt/inicio`)
    expect(ir(P, "/pt/cadastro")).toBe(`${A}/pt/cadastro`)
    expect(ir(P, "/en")).toBe(`${P}/en/admin`)
    expect(ir(P, "/pt/awards")).toBe(`${A}/pt/awards`)
  })
  it("só o app definido (painel no mesmo endereço) não manda ninguém ao admin", () => {
    const so = { site: S, app: A, admin: A }
    expect(enderecoCerto(A, "/pt", so)).toBe(`${A}/pt/inicio`)
    expect(enderecoCerto(A, "/pt/entrar", so)).toBeNull()
    expect(enderecoCerto(A, "/pt/admin", so)).toBeNull()
    expect(inicioDepoisDoLogin(A, so)).toBe("/inicio")
  })
  it("home do site e destino do login", () => {
    expect(linkSite("/pt", sites)).toBe(`${S}/pt`)
    expect(linkSite("/pt", { site: S, app: S, admin: S })).toBe("/pt")
    expect(inicioDepoisDoLogin(P, sites)).toBe("/admin")
    expect(inicioDepoisDoLogin(A, sites)).toBe("/inicio")
  })
  it("fora dos três endereços, ou com tudo no mesmo endereço, não mexe", () => {
    expect(ir("http://127.0.0.1:5190", "/pt/admin")).toBeNull()
    expect(enderecoCerto(S, "/pt/admin", { site: S, app: S, admin: S })).toBeNull()
    expect(enderecoCerto(S, "/pt", { site: S, app: S, admin: S })).toBeNull()
    expect(ir(S, "/entrar")).toBeNull()
  })
  it("volta do login só para caminho deste endereço", () => {
    expect(caminhoInterno("/pt/planos")).toBe("/pt/planos")
    for (const ruim of ["//evil.com", "/\\evil.com", "/\t/evil.com", "https://evil.com", "javascript:x", "", null, undefined])
      expect(caminhoInterno(ruim)).toBeNull()
  })
  it("painel e app separados só com endereços próprios", () => {
    expect(ehPainel(P, sites)).toBe(true)
    expect(ehPainel(A, sites)).toBe(false)
    expect(ehAppSeparado(A, sites)).toBe(true)
    expect(ehAppSeparado(P, sites)).toBe(false)
    const um = { site: S, app: S, admin: S }
    expect(ehPainel(S, um)).toBe(false)
    expect(ehAppSeparado(S, um)).toBe(false)
  })
})
