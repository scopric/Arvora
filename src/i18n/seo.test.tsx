import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useNavigate } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import cfg from "../../vercel.json" with { type: "json" }
import { ErrorBoundary, HydrateFallback, chaveErro, meta } from "../root"
import { en } from "./en"
import { textosDe, useTitulo } from "./index"
import { pt } from "./pt"

beforeEach(() => {
  localStorage.clear()
  document.title = ""
  document.head.innerHTML = '<meta name="description" content="x">'
  vi.spyOn(navigator, "languages", "get").mockReturnValue(["pt-BR"])
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("paridade", () => {
  it("pt e en têm as mesmas chaves", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(pt).sort())
  })
})

function Tela({ noindex }: { noindex?: boolean }) {
  useTitulo("titulo.entrar", noindex)
  const ir = useNavigate()
  return <button onClick={() => ir("/en/entrar")}>trocar</button>
}
const tela = (url: string, noindex?: boolean) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/:lang/entrar" element={<Tela noindex={noindex} />} />
      </Routes>
    </MemoryRouter>,
  )
const robots = () => document.querySelector('meta[name="robots"]')?.getAttribute("content")

describe("useTitulo", () => {
  it("título e description em pt e em en", () => {
    tela("/pt/entrar")
    expect(document.title).toBe("Entrar — Grupo Árvora")
    expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toBe(pt["doc.descricao"])
    cleanup()
    tela("/en/entrar")
    expect(document.title).toBe("Log in — Grupo Árvora")
    expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toBe(en["doc.descricao"])
  })

  it("acompanha a troca de idioma", async () => {
    tela("/pt/entrar")
    await userEvent.click(screen.getByText("trocar"))
    expect(document.title).toBe("Log in — Grupo Árvora")
  })

  it("noindex entra e sai com a tela", () => {
    tela("/pt/entrar", true)
    expect(robots()).toBe("noindex")
    cleanup()
    expect(robots()).toBeUndefined()
  })
})

describe("meta do root", () => {
  const descricao = (lang?: string) =>
    (meta({ params: { lang } }) as { name?: string; content?: string }[]).find((m) => m.name === "description")?.content
  it("en → inglês; pt e inválido → português", () => {
    expect(descricao("en")).toBe(en["doc.descricao"])
    expect(descricao("pt")).toBe(pt["doc.descricao"])
    expect(descricao("xx")).toBe(pt["doc.descricao"])
    expect(descricao(undefined)).toBe(pt["doc.descricao"])
  })
})

describe("fallbacks do root", () => {
  const sob = (url: string, el: React.ReactNode) =>
    render(<MemoryRouter initialEntries={[url]}>{el}</MemoryRouter>)

  it.each([
    ["/en/perfil", en["sistema.carregando"]],
    ["/pt/perfil", pt["sistema.carregando"]],
    ["/perfil", pt["sistema.carregando"]],
  ])("HydrateFallback %s", (url, texto) => {
    sob(url, <HydrateFallback />)
    expect(screen.getByRole("status").textContent).toBe(texto)
  })

  it.each([
    ["/en/x", "en", en],
    ["/pt/x", "pt", pt],
    ["/x", "pt", pt],
  ] as const)("ErrorBoundary %s", (url, lang, dic) => {
    sob(url, <ErrorBoundary error={new Error("falha")} />)
    expect(screen.getByRole("heading").textContent).toBe(dic["sistema.erro"])
    const link = screen.getByRole("link")
    expect(link.textContent).toBe(dic["sistema.voltar"])
    expect(link.getAttribute("href")).toBe(`/${lang}`)
  })

  it("chaveErro: 404 e genérico", () => {
    expect(chaveErro({ status: 404, statusText: "", internal: true, data: "" })).toBe("sistema.naoEncontrada")
    expect(chaveErro({ status: 500, statusText: "", internal: true, data: "" })).toBe("sistema.erro")
    expect(chaveErro(new Error("x"))).toBe("sistema.erro")
    expect(textosDe("en")["sistema.naoEncontrada"]).toBe("Page not found")
  })
})

describe("vercel.json: X-Robots-Tag", () => {
  const regra = cfg.headers.find((h) => h.headers.some((x) => x.key === "X-Robots-Tag"))!
  const re = new RegExp(`^${regra.source}$`)
  it("noindex nas 6 telas, em pt e en", () => {
    expect(regra.headers[0].value).toBe("noindex, nofollow")
    for (const l of ["pt", "en"])
      for (const t of ["entrar", "cadastro", "recuperar-senha", "redefinir-senha", "confirmar", "perfil"]) {
        expect(re.test(`/${l}/${t}`)).toBe(true)
        expect(re.test(`/${l}/${t}/`)).toBe(true)
      }
  })
  it("home e páginas públicas não casam", () => {
    for (const p of ["/", "/pt", "/en", "/pt/hall-of-fame", "/en/hall-of-fame/2026/fulano", "/pt/perfilx"]) expect(re.test(p)).toBe(false)
  })
})
