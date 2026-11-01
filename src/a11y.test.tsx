import { cleanup, render, screen } from "@testing-library/react"
import axe from "axe-core"
import { createRoutesStub, MemoryRouter } from "react-router"
import { afterEach, describe, expect, it, vi } from "vitest"

const estado = vi.hoisted(() => ({ sessao: null as unknown }))
vi.mock("./lib/sessao", () => ({ useAuth: () => ({ sessao: estado.sessao, carregando: false }), sair: vi.fn() }))
vi.mock("./lib/supabase", () => ({
  supabase: { auth: { mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: "aal2" }, error: null }) } } },
}))

import { Rotas } from "./App"
import { Abas } from "./componentes/Abas"
import { Aviso } from "./componentes/Aviso"
import { Botao } from "./componentes/Botao"
import { Campo } from "./componentes/Campo"
import { DialogoConfirmar } from "./componentes/DialogoConfirmar"
import { BannerCookies } from "./componentes/BannerCookies"
import { Bloqueado } from "./componentes/Bloqueado"
import { Cartao } from "./componentes/Cartao"
import { Erro } from "./componentes/Erro"
import { EscopoApp } from "./componentes/escopo"
import { Esqueleto } from "./componentes/Esqueleto"
import { PlayerVideo } from "./componentes/PlayerVideo"
import { Selo } from "./componentes/Selo"
import { Tabela } from "./componentes/Tabela"
import { Vazio } from "./componentes/Vazio"
import { AcessoContext } from "./lib/acesso"
import { renderiza, simularDialog } from "./testeUtil"
import HallOfFame, { loader as loaderHall } from "./rotas/hall-of-fame"
import Premiado, { loader as loaderPremiado } from "./rotas/premiado"
import premiados from "./dados/premiados-exemplo.json" with { type: "json" }

simularDialog()
afterEach(() => {
  cleanup()
  estado.sessao = null
})

// jsdom não calcula layout nem cor: o contraste é medido no Lighthouse, não aqui.
async function violacoes() {
  const r = await axe.run(document.body, { rules: { "color-contrast": { enabled: false } } })
  return r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target).join(", ")}`)
}

const p = premiados[0]
const telas: [string, () => void][] = [
  ...["pt", "en"].flatMap((l): [string, () => void][] =>
    ["", "/entrar", "/cadastro", "/recuperar-senha"].map((c) => [
      `/${l}${c}`,
      () => render(<MemoryRouter initialEntries={[`/${l}${c}`]}><Rotas /></MemoryRouter>),
    ]),
  ),
  ...["pt", "en"].flatMap((l): [string, () => void][] => [
    [`/${l}/hall-of-fame`, () => {
      const Stub = createRoutesStub([{ path: "/:lang/hall-of-fame", Component: HallOfFame, loader: loaderHall as never }])
      render(<Stub initialEntries={[`/${l}/hall-of-fame`]} />)
    }],
    [`/${l}/hall-of-fame/${p.edicao}/${p.slug}`, () => {
      const Stub = createRoutesStub([{ path: "/:lang/hall-of-fame/:edicao/:slug", Component: Premiado, loader: loaderPremiado as never }])
      render(<Stub initialEntries={[`/${l}/hall-of-fame/${p.edicao}/${p.slug}`]} />)
    }],
  ]),
]

// Layouts: público (visitante), membro (Clube e Grupo) e admin (equipe em aal2), nos dois idiomas.
const logado = { user: { id: "u1", email: "ana@exemplo.invalid" } }
const comAcesso = (acesso: object, url: string) => {
  estado.sessao = logado
  render(
    <AcessoContext value={{ carregando: false, erro: false, nivel: "clube", premiado: false, equipe: false, papel: null, recarregar: () => {}, ...acesso }}>
      <MemoryRouter initialEntries={[url]}><Rotas /></MemoryRouter>
    </AcessoContext>,
  )
}
const layouts: [string, () => void][] = ["pt", "en"].flatMap((l): [string, () => void][] => [
  [`layout público /${l}/planos`, () => render(<MemoryRouter initialEntries={[`/${l}/planos`]}><Rotas /></MemoryRouter>)],
  [`layout membro (Clube) /${l}/inicio`, () => comAcesso({ nivel: "clube" }, `/${l}/inicio`)],
  [`layout membro (Grupo, premiado) /${l}/network`, () => comAcesso({ nivel: "grupo", premiado: true }, `/${l}/network`)],
  [`layout admin /${l}/admin/aulas`, () => comAcesso({ equipe: true, papel: "super_admin" }, `/${l}/admin/aulas`)],
])

describe("acessibilidade dos layouts (axe)", () => {
  it.each(layouts)("%s sem violações", async (_nome, montar) => {
    montar()
    await screen.findByRole("heading", { level: 1 })
    expect(await violacoes()).toEqual([])
  })
})

describe("acessibilidade dos componentes comuns (axe)", () => {
  it.each(["pt", "en"])("componentes (%s) sem violações (o iframe do player fica de fora: o axe não entra em iframe no jsdom)", async (l) => {
    renderiza(
      <main>
        <h1>Componentes</h1>
        <Esqueleto />
        <Vazio titulo="Tudo em dia">Nada pendente.</Vazio>
        <Erro aoTentar={() => {}} />
        <Cartao><p>Cartão</p></Cartao>
        <Selo tom="dourado">Premiado</Selo>
        <Bloqueado previa={<h2>Prévia</h2>} frase="As aulas semanais fazem parte do Grupo Árvora." />
        <Abas rotulo="Aprender" abas={[{ chave: "a", rotulo: "Aulas", conteudo: <p>A</p> }, { chave: "b", rotulo: "Academy", conteudo: <p>B</p> }]} />
        <Tabela legenda="Membros" id={(m) => m.id} linhas={[{ id: 1, nome: "Ana" }]} colunas={[{ chave: "nome", titulo: "Nome", celula: (m) => m.nome }]} />
        <PlayerVideo titulo="Aula 1" tipo="arquivo" src="https://exemplo.invalid/a.mp4" legendas={[{ src: "https://exemplo.invalid/a.vtt", idioma: "pt", rotulo: "Português", padrao: true }]} />
      </main>,
      `/${l}`,
    )
    expect(await violacoes()).toEqual([])
  })
})

describe("acessibilidade dos componentes comuns no escopo do app (axe)", () => {
  it.each(["pt", "en"])("componentes do app (%s) sem violações", async (l) => {
    renderiza(
      <EscopoApp value>
        <main className="app">
          <h1>Componentes</h1>
          <Esqueleto />
          <Vazio titulo="Tudo em dia">Nada pendente.</Vazio>
          <Erro aoTentar={() => {}} />
          <Cartao><p>Cartão</p></Cartao>
          <Selo tom="dourado">Premiado</Selo>
          <Bloqueado previa={<h2>Prévia</h2>} frase="As aulas semanais fazem parte do Grupo Árvora." />
          <Abas rotulo="Aprender" abas={[{ chave: "a", rotulo: "Aulas", conteudo: <p>A</p> }, { chave: "b", rotulo: "Academy", conteudo: <p>B</p> }]} />
          <Tabela legenda="Membros" id={(m) => m.id} linhas={[{ id: 1, nome: "Ana" }]} colunas={[{ chave: "nome", titulo: "Nome", celula: (m) => m.nome }]} />
          <Campo rotulo="Nome" ajuda="Como aparece no perfil" />
          <Botao>Salvar</Botao>
          <Botao variante="contorno">Cancelar</Botao>
          <Aviso tipo="ok">Salvo.</Aviso>
          <DialogoConfirmar aberto titulo="Confirmar" texto="Tem certeza?" aoConfirmar={() => {}} aoCancelar={() => {}} />
        </main>
      </EscopoApp>,
      `/${l}`,
    )
    expect(await violacoes()).toEqual([])
  })
})

describe("acessibilidade (axe)", () => {
  it.each(telas)("%s sem violações", async (_url, montar) => {
    montar()
    await screen.findByRole("heading", { level: 1 })
    expect(await violacoes()).toEqual([])
  })

  it.each(["pt", "en"])("banner de cookies (%s) sem violações", async (l) => {
    localStorage.clear()
    render(<MemoryRouter initialEntries={[`/${l}`]}><BannerCookies /></MemoryRouter>)
    await screen.findByRole("button", { name: l === "pt" ? "Aceitar" : "Accept" })
    expect(await violacoes()).toEqual([])
  })
})
