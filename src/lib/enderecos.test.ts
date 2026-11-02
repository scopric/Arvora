import { describe, expect, it } from "vitest"
import { enderecoCerto } from "./enderecos"

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
  })
  it("app devolve o público ao site e abre no Início", () => {
    expect(ir(A, "/pt/termos")).toBe(`${S}/pt/termos`)
    expect(ir(A, "/pt/inicio")).toBeNull()
    expect(ir(A, "/pt")).toBe(`${A}/pt/inicio`)
    expect(ir(A, "/pt/admin")).toBe(`${P}/pt/admin`)
  })
  it("painel só tem admin e entrar", () => {
    expect(ir(P, "/pt/admin")).toBeNull()
    expect(ir(P, "/pt/entrar")).toBeNull()
    expect(ir(P, "/pt/inicio")).toBe(`${A}/pt/inicio`)
    expect(ir(P, "/pt/cadastro")).toBe(`${A}/pt/cadastro`)
    expect(ir(P, "/en")).toBe(`${P}/en/admin`)
  })
  it("fora dos três endereços, ou com tudo no mesmo endereço, não mexe", () => {
    expect(ir("http://127.0.0.1:5190", "/pt/admin")).toBeNull()
    expect(enderecoCerto(S, "/pt/admin", { site: S, app: S, admin: S })).toBeNull()
    expect(enderecoCerto(S, "/pt", { site: S, app: S, admin: S })).toBeNull()
    expect(ir(S, "/entrar")).toBeNull()
  })
})
