import { describe, expect, it } from "vitest"
import { cadastroSchema, errosPorCampo, loginSchema, mensagemDeErroAuth, perfilSchema } from "./validacao"

const cadastroOk = { nome: "Ana", email: "ANA@Exemplo.com ", senha: "Abcdef12", maior18: true }

describe("cadastro", () => {
  it("normaliza o e-mail e aceita dados válidos", () => {
    const r = cadastroSchema.safeParse(cadastroOk)
    expect(r.success && r.data.email).toBe("ana@exemplo.com")
  })

  it("exige a declaração de 18 anos (CON-07)", () => {
    const r = cadastroSchema.safeParse({ ...cadastroOk, maior18: false })
    expect(r.success).toBe(false)
    if (!r.success) expect(errosPorCampo(r.error).maior18).toMatch(/18 anos/)
  })

  it.each(["curta1A", "semnumeroAAA", "SEMMINUSCULA1", "semmaiuscula1"])("recusa a senha fraca %s", (senha) => {
    expect(cadastroSchema.safeParse({ ...cadastroOk, senha }).success).toBe(false)
  })

  it("recusa nome vazio e e-mail inválido, com a mensagem no campo certo", () => {
    const r = cadastroSchema.safeParse({ ...cadastroOk, nome: "  ", email: "x" })
    expect(r.success).toBe(false)
    if (!r.success) expect(Object.keys(errosPorCampo(r.error)).sort()).toEqual(["email", "nome"])
  })
})

describe("login", () => {
  it("só pede senha preenchida (a regra de força vale no cadastro, não aqui)", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", senha: "x" }).success).toBe(true)
    expect(loginSchema.safeParse({ email: "a@b.com", senha: "" }).success).toBe(false)
  })
})

describe("perfil", () => {
  const base = {
    nome: "Ana",
    empresa_nome: "",
    setor_id: "",
    cidade: "",
    pais: "",
    linkedin_url: "",
    instagram: "",
    bio: "",
    visibilidade: "membros",
  }

  it("campos vazios viram null, como o banco espera", () => {
    const r = perfilSchema.safeParse(base)
    expect(r.success && r.data).toMatchObject({ empresa_nome: null, setor_id: null, pais: null, instagram: null, bio: null })
  })

  it("converte país para maiúsculas, tira o @ do Instagram e o setor vira número", () => {
    const r = perfilSchema.safeParse({ ...base, pais: "ie", instagram: "@ana.dublin", setor_id: "7" })
    expect(r.success && r.data).toMatchObject({ pais: "IE", instagram: "ana.dublin", setor_id: 7 })
  })

  it("recusa LinkedIn fora do domínio linkedin.com e esquemas perigosos", () => {
    for (const url of ["javascript:alert(1)", "http://linkedin.com/in/x", "https://evil.com/linkedin.com/"]) {
      expect(perfilSchema.safeParse({ ...base, linkedin_url: url }).success).toBe(false)
    }
    expect(perfilSchema.safeParse({ ...base, linkedin_url: "https://www.linkedin.com/in/ana" }).success).toBe(true)
  })

  it("recusa bio acima de 600 e visibilidade desconhecida", () => {
    expect(perfilSchema.safeParse({ ...base, bio: "a".repeat(601) }).success).toBe(false)
    expect(perfilSchema.safeParse({ ...base, visibilidade: "todos" }).success).toBe(false)
  })
})

describe("mensagemDeErroAuth", () => {
  it("traduz credencial inválida e nunca mostra texto técnico", () => {
    expect(mensagemDeErroAuth({ code: "invalid_credentials", message: "Invalid login credentials" })).toMatch(/incorretos/)
    expect(mensagemDeErroAuth({ message: "PGRST301 jwt expired" })).not.toMatch(/PGRST|jwt/)
  })
})
