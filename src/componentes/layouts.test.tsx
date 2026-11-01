import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({
  aal: "aal2" as string,
  fatores: [] as { id: string }[],
  naoVerificados: [] as { id: string; factor_type: string; status: string }[],
  mfaFalha: false,
  logado: true,
}))
vi.mock("../lib/sessao", () => ({
  useAuth: () => ({ sessao: h.logado ? { user: { id: "u1", email: "ana@exemplo.invalid" } } : null, carregando: false }),
  sair: vi.fn(),
}))
vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: h.aal, nextLevel: "aal2" }, error: null }),
        listFactors: async () => ({ data: { totp: h.fatores, all: [...h.fatores, ...h.naoVerificados] }, error: null }),
        unenroll: vi.fn(async () => ({ error: null })),
        enroll: vi.fn(async () => ({ data: { id: "f2", totp: { qr_code: "data:image/svg+xml;utf8,<svg/>", secret: "SEGREDO123" } }, error: null })),
        challengeAndVerify: vi.fn(async () => {
          if (h.mfaFalha) return { error: { code: "mfa_verification_failed" } }
          h.aal = "aal2"
          return { error: null }
        }),
      },
    },
  },
}))

import { AcessoContext, type Acesso } from "../lib/acesso"
import { LayoutAdmin } from "./LayoutAdmin"
import { LayoutMembro } from "./LayoutMembro"
import { LayoutPublico } from "./LayoutPublico"
import { Botao } from "./Botao"
import { simularDialog } from "../testeUtil"

simularDialog()
const acessoBase: Acesso = { carregando: false, erro: false, nivel: "clube", premiado: false, equipe: false, papel: null, recarregar: () => {} }

function montar(acesso: Partial<Acesso>, url: string, layout: React.ReactElement, filha = "inicio") {
  return render(
    <AcessoContext value={{ ...acessoBase, ...acesso }}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/:lang" element={layout}>
            <Route path={filha} element={<h1>Tela de dentro</h1>} />
            <Route index element={<h1>Raiz</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AcessoContext>,
  )
}

beforeEach(() => Object.assign(h, { aal: "aal2", fatores: [], naoVerificados: [], mfaFalha: false, logado: true }))
afterEach(cleanup)

describe("LayoutMembro", () => {
  it("Clube: itens do Grupo ficam com cadeado e motivo para leitor de tela; Meu Award some sem premiado", () => {
    montar({ nivel: "clube" }, "/pt/inicio", <LayoutMembro />)
    const lateral = screen.getByRole("navigation", { name: "Menu do membro" })
    const aulas = within(lateral).getByRole("link", { name: /Aulas/ })
    expect(aulas.textContent).toContain("Bloqueado: parte do Grupo Árvora")
    expect(aulas.getAttribute("title")).toBe("Incluído no Grupo Árvora")
    expect(aulas.getAttribute("href")).toBe("/pt/aulas") // continua clicável: abre a prévia
    expect(within(lateral).getByRole("link", { name: "Academy" }).textContent).not.toContain("Bloqueado")
    expect(within(lateral).queryByRole("link", { name: /Meu Award/ })).toBeNull()
    expect(screen.getByRole("heading", { name: "Tela de dentro" })).toBeTruthy()
  })

  it("Grupo premiado: nada bloqueado e Meu Award aparece", () => {
    montar({ nivel: "grupo", premiado: true }, "/pt/inicio", <LayoutMembro />)
    const lateral = screen.getByRole("navigation", { name: "Menu do membro" })
    expect(within(lateral).queryByText(/Bloqueado/)).toBeNull()
    expect(within(lateral).getByRole("link", { name: /Meu Award/ })).toBeTruthy()
  })

  it("tab bar do celular tem 5 itens (4 links + Mais)", () => {
    montar({}, "/en/inicio", <LayoutMembro />)
    const abas = screen.getByRole("navigation", { name: "Quick navigation" })
    expect(within(abas).getAllByRole("link").length + within(abas).getAllByRole("button").length).toBe(5)
  })

  it("erro de acesso aparece como erro com 'tentar de novo', não como tela sem acesso", async () => {
    const recarregar = vi.fn()
    montar({ erro: true, recarregar }, "/pt/inicio", <LayoutMembro />)
    expect(screen.getByRole("alert").textContent).toContain("Não conseguimos conferir o seu acesso")
    expect(screen.queryByRole("heading", { name: "Tela de dentro" })).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }))
    expect(recarregar).toHaveBeenCalledOnce()
  })

  it("carregando mostra esqueleto, não a tela", () => {
    montar({ carregando: true }, "/pt/inicio", <LayoutMembro />)
    expect(screen.getByRole("status", { name: "Carregando o conteúdo" })).toBeTruthy()
    expect(screen.queryByRole("heading", { name: "Tela de dentro" })).toBeNull()
  })

  it("menu do avatar abre, mostra e-mail e nível e fecha com Esc", async () => {
    montar({ nivel: "grupo" }, "/pt/inicio", <LayoutMembro />)
    const u = userEvent.setup()
    await u.click(screen.getByRole("button", { name: "Menu da conta" }))
    expect(screen.getByText("ana@exemplo.invalid")).toBeTruthy()
    expect(screen.getByText(/Nível: Grupo Árvora/)).toBeTruthy()
    await u.keyboard("{Escape}")
    expect(screen.queryByText("ana@exemplo.invalid")).toBeNull()
  })
})

describe("LayoutPublico", () => {
  it("com sessão, rotas de conteúdo abrem na casca do membro (sidebar), não no topo público", () => {
    montar({}, "/pt/planos", <LayoutPublico />, "planos")
    expect(screen.getByRole("navigation", { name: "Menu do membro" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Tela de dentro" })).toBeTruthy()
    expect(screen.queryByRole("contentinfo")).toBeNull()
  })

  it("com sessão, o miolo das rotas de conteúdo mantém o visual público (Decisão 55): só a casca é do app", () => {
    render(
      <AcessoContext value={acessoBase}>
        <MemoryRouter initialEntries={["/pt/planos"]}>
          <Routes>
            <Route path="/:lang" element={<LayoutPublico />}>
              <Route path="planos" element={<><h1>Tela de dentro</h1><Botao>Assinar</Botao></>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AcessoContext>,
    )
    expect(screen.getByRole("navigation", { name: "Menu do membro" })).toBeTruthy()
    const botao = screen.getByRole("button", { name: "Assinar" })
    expect(botao.className).toContain("min-h-12 w-full") // variante pública do Botao
    expect(screen.getByRole("main").classList.contains("app")).toBe(false)
  })

  it("com sessão, termos e privacidade seguem com o topo público", () => {
    montar({}, "/pt/termos", <LayoutPublico />, "termos")
    expect(screen.queryByRole("navigation", { name: "Menu do membro" })).toBeNull()
    expect(screen.getByRole("contentinfo")).toBeTruthy()
  })

  it("tem topo, rodapé e o conteúdo dentro de <main>", () => {
    h.logado = false
    montar({}, "/pt/planos", <LayoutPublico />, "planos")
    expect(screen.queryByRole("navigation", { name: "Menu do membro" })).toBeNull()
    expect(within(screen.getByRole("main")).getByRole("heading", { name: "Tela de dentro" })).toBeTruthy()
    expect(screen.getByRole("banner")).toBeTruthy()
    expect(screen.getByRole("contentinfo")).toBeTruthy()
  })
})

describe("LayoutAdmin", () => {
  const admin = { equipe: true, papel: "super_admin" as const }

  it("quem não é da equipe vê 404, sem pista do painel", () => {
    montar({ equipe: false }, "/pt/aulas", <LayoutAdmin />, "aulas")
    expect(screen.getByRole("heading", { name: "Página não encontrada" })).toBeTruthy()
    expect(screen.queryByRole("heading", { name: "Tela de dentro" })).toBeNull()
  })

  it("erro de leitura aparece como erro, não como 404", () => {
    montar({ erro: true }, "/pt/aulas", <LayoutAdmin />, "aulas")
    expect(screen.getByRole("alert")).toBeTruthy()
    expect(screen.queryByRole("heading", { name: "Página não encontrada" })).toBeNull()
  })

  it("equipe com aal2 entra e vê o menu de administração", async () => {
    montar(admin, "/pt/aulas", <LayoutAdmin />, "aulas")
    expect(await screen.findByRole("heading", { name: "Tela de dentro" })).toBeTruthy()
    expect(screen.getAllByRole("navigation", { name: "Menu da administração" }).length).toBeGreaterThan(0)
  })

  it("equipe sem fator TOTP: tela de cadastrar o fator, com QR; depois do código correto libera", async () => {
    h.aal = "aal1"
    montar(admin, "/pt/aulas", <LayoutAdmin />, "aulas")
    const u = userEvent.setup()
    await u.click(await screen.findByRole("button", { name: "Cadastrar o aplicativo" }))
    expect((await screen.findByAltText(/QR code/)).getAttribute("src")).toContain("data:image/svg+xml")
    expect(screen.getByText("SEGREDO123")).toBeTruthy()
    await u.type(screen.getByLabelText("Código de 6 dígitos"), "123456")
    await u.click(screen.getByRole("button", { name: "Verificar" }))
    expect(await screen.findByRole("heading", { name: "Tela de dentro" })).toBeTruthy()
  })

  it("com fator e aal1: pede o código; código errado mostra erro e não libera", async () => {
    h.aal = "aal1"
    h.fatores = [{ id: "f1" }]
    h.mfaFalha = true
    montar(admin, "/pt/aulas", <LayoutAdmin />, "aulas")
    const u = userEvent.setup()
    await u.type(await screen.findByLabelText("Código de 6 dígitos"), "000000")
    await u.click(screen.getByRole("button", { name: "Verificar" }))
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Código incorreto"))
    expect(screen.queryByRole("heading", { name: "Tela de dentro" })).toBeNull()
  })

  it("código que não tem 6 dígitos nem chega ao Supabase", async () => {
    h.aal = "aal1"
    h.fatores = [{ id: "f1" }]
    montar(admin, "/pt/aulas", <LayoutAdmin />, "aulas")
    const u = userEvent.setup()
    await u.type(await screen.findByLabelText("Código de 6 dígitos"), "12ab")
    await u.click(screen.getByRole("button", { name: "Verificar" }))
    expect((await screen.findByRole("alert")).textContent).toContain("Código incorreto")
  })
})
