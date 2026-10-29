import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const estado = vi.hoisted(() => ({ sessao: null as unknown, carregando: false }))
const auth = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
}))
vi.mock("../lib/sessao", () => ({ useAuth: () => estado }))
vi.mock("../lib/supabase", () => ({ supabase: { auth } }))

import { Rotas } from "../App"
import { en } from "./en"
import { pt } from "./pt"

const ir = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Rotas />
    </MemoryRouter>,
  )

beforeEach(() => {
  estado.sessao = null
  estado.carregando = false
  for (const f of Object.values(auth)) f.mockReset()
})
afterEach(cleanup)

// Palavras que só existem em português; o texto das telas em /en não pode conter nenhuma.
const PORTUGUES = /Entrar|[Ss]enha|e-mail|Informe|Criar conta|Esqueci|Aguarde|Carregando|Confirme|Voltar|Nome|[Ll]ink inv|inválido|conta/
const telasAuth = ["/en/entrar", "/en/cadastro", "/en/recuperar-senha", "/en/redefinir-senha"]

describe("varredura: telas de auth em /en", () => {
  // Envia o formulário vazio para que as mensagens de validação também entrem na varredura.
  it.each(telasAuth)("%s não tem texto em português", async (url) => {
    estado.sessao = url.includes("redefinir") ? { user: { id: "u1" } } : null
    ir(url)
    await userEvent.click(screen.getByRole("button", { name: /log in|create account|send link|save password/i }))
    await screen.findAllByRole("alert")
    const texto = document.body.textContent ?? ""
    expect(texto).not.toMatch(PORTUGUES)
    expect(texto.length).toBeGreaterThan(20)
  })

  it("estados alternativos: link inválido, verificando e e-mail enviado", async () => {
    ir("/en/redefinir-senha")
    expect(document.body.textContent).not.toMatch(PORTUGUES)
    expect(screen.getByRole("heading", { name: en["redefinir.invalido.titulo"] })).toBeTruthy()
    cleanup()
    estado.carregando = true
    ir("/en/redefinir-senha")
    expect(screen.getByText(en["redefinir.verificando"])).toBeTruthy()
    cleanup()
    estado.carregando = false
    auth.resetPasswordForEmail.mockResolvedValue({ error: null })
    ir("/en/recuperar-senha")
    await userEvent.type(screen.getByLabelText(en["auth.email.rotulo"]), "a@b.com")
    await userEvent.click(screen.getByRole("button", { name: en["recuperar.botao"] }))
    expect(await screen.findByRole("status")).toBeTruthy()
    expect(document.body.textContent).not.toMatch(PORTUGUES)
  })
})

describe("erros traduzidos", () => {
  it("erro do Zod: EN em /en/entrar, PT em /pt/entrar", async () => {
    ir("/en/entrar")
    await userEvent.click(screen.getByRole("button", { name: en["entrar.botao"] }))
    expect(await screen.findByText(en["validacao.email.obrigatorio"])).toBeTruthy()
    cleanup()
    ir("/pt/entrar")
    await userEvent.click(screen.getByRole("button", { name: pt["entrar.botao"] }))
    expect(await screen.findByText(pt["validacao.email.obrigatorio"])).toBeTruthy()
  })

  it("erro do Supabase Auth: EN em /en/entrar, PT em /pt/entrar", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { code: "invalid_credentials", message: "Invalid login credentials" } })
    for (const [lang, d] of [["en", en], ["pt", pt]] as const) {
      ir(`/${lang}/entrar`)
      await userEvent.type(screen.getByLabelText(d["auth.email.rotulo"]), "a@b.com")
      await userEvent.type(screen.getByLabelText(d["auth.senha.rotulo"]), "x")
      await userEvent.click(screen.getByRole("button", { name: d["entrar.botao"] }))
      expect((await screen.findByRole("alert")).textContent).toBe(d["erro.auth.invalid_credentials"])
      cleanup()
    }
  })

  it("código desconhecido cai na mensagem genérica, sem texto técnico", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { code: "xyz", message: "PGRST301 jwt expired" } })
    ir("/en/entrar")
    await userEvent.type(screen.getByLabelText(en["auth.email.rotulo"]), "a@b.com")
    await userEvent.type(screen.getByLabelText(en["auth.senha.rotulo"]), "x")
    await userEvent.click(screen.getByRole("button", { name: en["entrar.botao"] }))
    expect((await screen.findByRole("alert")).textContent).toBe(en["erro.auth.default"])
  })
})

describe("idioma no cadastro", () => {
  it.each(["pt", "en"] as const)("signUp recebe idioma=%s", async (lang) => {
    auth.signUp.mockResolvedValue({ error: null })
    const d = lang === "en" ? en : pt
    ir(`/${lang}/cadastro`)
    await userEvent.type(screen.getByLabelText(d["cadastro.nome"]), "Ana")
    await userEvent.type(screen.getByLabelText(d["auth.email.rotulo"]), "ana@exemplo.com")
    await userEvent.type(screen.getByLabelText(d["auth.senha.rotulo"]), "Abcdefg1")
    await userEvent.click(screen.getByLabelText(d["cadastro.maior18"]))
    await userEvent.click(screen.getByRole("button", { name: d["cadastro.botao"] }))
    await waitFor(() => expect(auth.signUp).toHaveBeenCalled())
    expect(auth.signUp.mock.calls[0][0].options.data.idioma).toBe(lang)
  })
})

describe("seletor nas telas de auth", () => {
  it("troca só o prefixo, mantendo busca e hash", () => {
    ir("/pt/entrar?a=1#x")
    expect(screen.getByRole("link", { name: "English" }).getAttribute("href")).toBe("/en/entrar?a=1#x")
    expect(screen.getByRole("link", { name: "Português" }).getAttribute("aria-current")).toBe("true")
  })
})
