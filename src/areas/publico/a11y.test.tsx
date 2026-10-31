import { cleanup, render, screen } from "@testing-library/react"
import axe from "axe-core"
import type { ReactElement } from "react"
import { MemoryRouter, Route, Routes } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../../lib/supabase", async () => (await import("./supabaseFalso")).moduloFalso)
vi.mock("../../lib/sessao", async () => (await import("./supabaseFalso")).moduloSessao)

import { AcessoContext } from "../../lib/acesso"
import { PaginaVideo } from "./componentes/PaginaVideo"
import { estado, falso, zerar } from "./supabaseFalso"
import { Awards } from "./telas/Awards"
import { Biblioteca } from "./telas/Biblioteca"
import { CadastrarEmpresa } from "./telas/CadastrarEmpresa"
import { CheckoutCancelado } from "./telas/CheckoutCancelado"
import { CheckoutSucesso } from "./telas/CheckoutSucesso"
import { Directory } from "./telas/Directory"
import { DirectoryEmpresa } from "./telas/DirectoryEmpresa"
import { Evento } from "./telas/Evento"
import { Legal } from "./telas/Legal"
import { Originals } from "./telas/Originals"
import { Planos } from "./telas/Planos"
import { Suporte } from "./telas/Suporte"

// O iframe do player fica de fora: o axe não entra em iframe no jsdom. Mesma medição do axe de src/a11y.test.tsx (contraste fica para o Lighthouse: jsdom não calcula cor).
async function violacoes() {
  const r = await axe.run({ include: [document.body], exclude: [["iframe"]] }, { rules: { "color-contrast": { enabled: false } } })
  return r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target).join(", ")}`)
}

const video = { id: 7, titulo: "Talk", slug: "talk", descricao: "d", duracao_min: 12, nivel_minimo: "clube", trailer_video_id: "https://exemplo.invalid/t", tema_id: 1 }
const edicao = { id: 1, slug: "ed", nome: "Edição", cidade: "Dublin", pais: "IE", descricao: "d", durante_inicio: "2026-11-10T10:00:00Z" }
const empresa = { status: "publicada", id: 1, nome: "Alfa", slug: "alfa", setor_id: 1, cidade: "Dublin", pais: "IE", logo_path: null, site: "https://exemplo.invalid", descricao: "Texto" }

beforeEach(() => {
  zerar()
  estado.sessao = null
  falso.tabelas = {
    planos: { data: [{ id: 1, nivel: "clube", intervalo: "mes", valor_centavos: 2700, moeda: "EUR" }, { id: 2, nivel: "grupo", intervalo: "mes", valor_centavos: 3700, moeda: "EUR" }], error: null },
    documentos_legais: { data: [{ titulo: "T", versao: "v1", vigente_desde: "2026-01-01T00:00:00Z", conteudo_md: "# A\n\ntexto\n\n- um\n- dois" }], error: null },
    videos: { data: [video], error: null },
    temas: { data: [{ id: 1, nome: "Tributação", nome_en: "Taxes", slug: "t" }], error: null },
    videos_citados: { data: [{ id: 1, premiados: { nome: "P", slug: "p", edicoes: { slug: "ed" } }, empresas: null }], error: null },
    salvos: { data: [], error: null },
    setores: { data: [{ id: 1, nome: "Tecnologia", nome_en: "Technology", slug: "tec" }], error: null },
    empresas: { data: [empresa], error: null },
    premiados: { data: [{ id: 1, empresa_id: 1, nome: "P", slug: "p", edicoes: { slug: "ed" } }], error: null },
    edicoes_publicas: { data: [{ ...edicao, fase: "durante" }], error: null },
    edicoes: { data: [{ transmissao_url: "https://exemplo.invalid/l", gravacao_video_id: "https://exemplo.invalid/g" }], error: null },
    categorias_premio: { data: [{ id: 1, nome: "Cat" }], error: null },
    indicados: { data: [{ id: 1, categoria_id: 1, nome: "Ind", resumo: "r" }], error: null },
    patrocinadores: { data: [{ id: 1, nome: "Patro", logo_path: null, site: "https://exemplo.invalid", nivel: "ouro" }], error: null },
    agenda_evento: { data: [{ id: 1, inicio_em: "2026-11-10T10:00:00Z", titulo: "Abertura", descricao: "d", local: "Sala" }], error: null },
  }
  falso.rpc.mockImplementation(async (nome: string) => ({ data: nome === "minhas_empresas" ? [] : "https://exemplo.invalid/v", error: null }))
})
afterEach(cleanup)

const telas: [string, string, ReactElement, boolean][] = [
  ["planos", "planos", <Planos key="Planos" />, false],
  ["planos (logado)", "planos", <Planos key="Planos" />, true],
  ["suporte", "suporte", <Suporte key="Suporte" email="s@exemplo.invalid" />, false],
  ["suporte sem canal", "suporte", <Suporte key="Suporte" />, false],
  ["termos", "termos", <Legal key="Legal" tipo="termos" titulo="publico.termos.titulo" />, false],
  ["privacidade", "privacidade", <Legal key="Legal" tipo="privacidade" titulo="publico.privacidade.titulo" />, false],
  ["checkout sucesso", "checkout/sucesso", <CheckoutSucesso key="CheckoutSucesso" />, true],
  ["checkout cancelado", "checkout/cancelado", <CheckoutCancelado key="CheckoutCancelado" />, false],
  ["awards", "awards", <Awards key="Awards" />, false],
  ["biblioteca", "biblioteca", <Biblioteca key="Biblioteca" />, false],
  ["biblioteca vídeo", "biblioteca/:slug", <PaginaVideo key="PaginaVideo" tipo="talk" base="/biblioteca" titulo="publico.bibliotecaVideo.titulo" />, true],
  ["originals", "originals", <Originals key="Originals" />, false],
  ["directory", "directory", <Directory key="Directory" />, false],
  ["directory empresa", "directory/:slug", <DirectoryEmpresa key="DirectoryEmpresa" />, true],
  ["cadastrar empresa", "cadastrar-empresa", <CadastrarEmpresa key="CadastrarEmpresa" />, true],
  ["evento", "evento/:edicao", <Evento key="Evento" />, false],
]

describe("acessibilidade da área pública (axe)", () => {
  it.each(telas.flatMap(([n, r, ui, l]) => ["pt", "en"].map((lang) => [`${n} (${lang})`, lang, r, ui, l] as const)))("%s sem violações", async (_n, lang, rota, ui, logado) => {
    if (logado) estado.sessao = { user: { id: "u1", email: "a@b.invalid" } }
    const url = `/${lang}/${rota.replace(":slug", "x").replace(":edicao", "ed")}`
    render(
      <AcessoContext value={{ carregando: false, erro: false, nivel: "clube", premiado: false, equipe: false, papel: null, recarregar: () => {} }}>
        <MemoryRouter initialEntries={[url]}>
          <main>
            <Routes>
              <Route path={`/:lang/${rota}`} element={ui} />
            </Routes>
          </main>
        </MemoryRouter>
      </AcessoContext>,
    )
    await screen.findByRole("heading", { level: 1 })
    // espera as leituras assentarem (sem esqueleto) antes de medir
    await vi.waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeNull())
    expect(await violacoes()).toEqual([])
  })
})
