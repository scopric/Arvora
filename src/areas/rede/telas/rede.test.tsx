import { cleanup, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import axe from "axe-core"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../../../lib/supabase", async () => (await import("../mockSupabase")).mockSupabase)
vi.mock("../../../lib/sessao", () => ({ useAuth: () => ({ sessao: { user: { id: "eu", email: "eu@exemplo.invalid" } }, carregando: false }), sair: vi.fn() }))

import { AcessoContext, type Acesso } from "../../../lib/acesso"
import { EscopoApp } from "../../../componentes/escopo"
import { renderiza, simularDialog, simularPopover } from "../../../testeUtil"
import { resp, zerar } from "../mockSupabase"
import { Comunidade } from "./Comunidade"
import { Conexoes } from "./Conexoes"
import { Match } from "./Match"
import { MeuAward } from "./MeuAward"
import { Network } from "./Network"
import { NetworkPerfil } from "./NetworkPerfil"
import { MemoryRouter, Route, Routes } from "react-router"
import { render } from "@testing-library/react"

simularDialog()
simularPopover()

const base: Acesso = { carregando: false, erro: false, nivel: "grupo", premiado: false, equipe: false, papel: null, recarregar: () => {} }
const com = (a: Partial<Acesso>, ui: ReactNode) => <AcessoContext value={{ ...base, ...a }}><main>{ui}</main></AcessoContext>
const mostra = (ui: ReactNode, url = "/pt", a: Partial<Acesso> = {}) => renderiza(com(a, ui), url)
// No escopo do app (como sob o LayoutMembro): só onde a classe testada existe apenas nesse ramo (Botao `pequeno`).
const mostraApp = (ui: ReactNode, url = "/pt", a: Partial<Acesso> = {}) => renderiza(<EscopoApp value>{com(a, ui)}</EscopoApp>, url)
const ok = (data: unknown) => ({ data, error: null })
const erro = (message: string, code = "P0001") => ({ data: null, error: { message, code } })
// Vitrine fictícia (sem nome real).
const ana = { id: "ana", nome: "Ana Exemplo", slug: "ana-exemplo", foto_path: null, empresa_nome: "Empresa X", setor_id: 1, cidade: "Dublin", pais: "IE", linkedin_url: null, instagram: null, bio: null }

async function semViolacoes() {
  const r = await axe.run(document.body, { rules: { "color-contrast": { enabled: false } } })
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(",")}`)).toEqual([])
}
const chamou = (onde: string) => resp.chamadas.filter((c) => c.onde === onde)

beforeEach(zerar)
afterEach(cleanup)

// Abre o último menu "⋯" da tela (popover nativo; o do comentário vem depois do post) e escolhe a ação.
async function escolher(nome: RegExp) {
  await userEvent.click((await screen.findAllByRole("button", { name: /^Mais opções/ })).at(-1)!)
  await userEvent.click(screen.getByRole("button", { name: nome }))
}

describe("Comunidade", () => {
  const espaco = { id: 1, titulo: "Geral", titulo_en: "General", descricao: null, nivel_minimo: "clube" }
  const post = { id: 10, autor_id: "ana", corpo: "Olá, pessoal", oculto_em: null, editado_em: null, criado_em: "2020-01-01T10:00:00Z" }
  beforeEach(() => {
    resp.tabelas.espacos = ok([espaco])
    resp.tabelas.posts = ok([post])
    resp.tabelas.perfis_vitrine = ok([ana])
  })

  it("lista post com autor, sem curtidas; Clube vê o espaço do Grupo bloqueado", async () => {
    mostra(<Comunidade />, "/pt", { nivel: "clube" })
    expect(await screen.findByText("Olá, pessoal")).toBeTruthy()
    expect(screen.getByText("Ana Exemplo")).toBeTruthy()
    expect(screen.queryByText(/curtir|curtida/i)).toBeNull()
    await userEvent.click(screen.getByRole("link", { name: "Grupo Árvora" }))
    expect(screen.getByText(/faz parte do Grupo Árvora/)).toBeTruthy()
    await semViolacoes()
  })

  it("visitante vê o cadeado e nenhuma leitura de posts", async () => {
    mostra(<Comunidade />, "/pt", { nivel: "visitante" })
    expect(await screen.findByText(/benefício do Clube e do Grupo/)).toBeTruthy()
    expect(screen.queryByRole("navigation", { name: "Espaços da comunidade" })).toBeNull()
    expect(chamou("posts")).toEqual([])
  })

  it("apagar barrado pelo RLS (denúncia aberta) mostra a mensagem, não 'apagado'", async () => {
    resp.tabelas.posts = ok([{ ...post, autor_id: "eu" }])
    resp.escritas["posts.delete"] = ok([])
    mostra(<Comunidade />)
    await escolher(/^Apagar/)
    const dialogo = document.querySelector<HTMLElement>("dialog[open]")!
    await userEvent.click(within(dialogo).getByRole("button", { name: /^Apagar$/, hidden: true }))
    expect((await screen.findByRole("alert")).textContent).toMatch(/em análise por causa de uma denúncia/)
  })

  it("editar fora da janela (UPDATE vazio) vira aviso de prazo", async () => {
    resp.tabelas.posts = ok([{ ...post, autor_id: "eu", criado_em: new Date().toISOString() }])
    resp.escritas["posts.update"] = ok([])
    mostra(<Comunidade />)
    await escolher(/^Editar/)
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }))
    expect((await screen.findByRole("alert")).textContent).toMatch(/prazo de edição/)
  })

  it("denunciar envia o post como alvo", async () => {
    mostra(<Comunidade />)
    await escolher(/^Denunciar/)
    await userEvent.selectOptions(screen.getByLabelText("Motivo", { selector: "select" }), "spam")
    await userEvent.click(screen.getByRole("button", { name: "Enviar denúncia" }))
    await waitFor(() => expect(chamou("denuncias.insert")[0]?.args).toMatchObject({ post_id: 10, motivo: "spam" }))
  })

  it("denúncia repetida (23505) diz 'você já denunciou'", async () => {
    resp.escritas["denuncias.insert"] = erro("duplicate", "23505")
    mostra(<Comunidade />)
    await escolher(/^Denunciar/)
    await userEvent.selectOptions(screen.getByLabelText("Motivo", { selector: "select" }), "spam")
    await userEvent.click(screen.getByRole("button", { name: "Enviar denúncia" }))
    expect(await screen.findByText(/Você já denunciou/)).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Enviar denúncia" })).toBeNull()
  })

  it("contagem de comentários no botão do post, feed sem violações de acessibilidade", async () => {
    resp.tabelas.posts = ok([{ ...post, comentarios: [{ count: 3 }] }])
    mostra(<Comunidade />)
    expect(await screen.findByRole("button", { name: "Comentários: 3" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Geral" }).getAttribute("aria-current")).toBe("page")
    await semViolacoes()
  })

  it("abrir a conversa atualiza a contagem pela lista carregada; o menu fecha depois da ação", async () => {
    resp.tabelas.posts = ok([{ ...post, comentarios: [{ count: 0 }] }])
    resp.tabelas.comentarios = ok([{ id: 5, autor_id: "ana", corpo: "Bem-vinda", oculto_em: null, editado_em: null, criado_em: "2020-01-01T11:00:00Z" }])
    mostra(<Comunidade />)
    await userEvent.click(await screen.findByRole("button", { name: "Comentários: 0" }))
    expect(await screen.findByRole("button", { name: "Comentários: 1" })).toBeTruthy()
    await escolher(/^Denunciar/)
    expect(screen.queryByRole("button", { name: /^Denunciar/ })).toBeNull()
    expect(document.querySelector("dialog[open]")).toBeTruthy()
  })

  it("?espaco=grupo leva quem é Grupo ao espaço do Grupo, não ao cadeado", async () => {
    resp.tabelas.espacos = ok([espaco, { id: 2, titulo: "Grupo Árvora", titulo_en: null, descricao: null, nivel_minimo: "grupo" }])
    mostra(<Comunidade />, "/pt?espaco=grupo", { nivel: "grupo" })
    expect((await screen.findByRole("link", { name: "Grupo Árvora" })).getAttribute("aria-current")).toBe("page")
    expect(screen.queryByText(/faz parte do Grupo Árvora/)).toBeNull()
  })

  it("falha ao ler posts mostra erro, não lista vazia", async () => {
    resp.tabelas.posts = { data: null, error: { message: "x" } }
    mostra(<Comunidade />)
    expect(await screen.findByText(/não conseguimos carregar os posts/i)).toBeTruthy()
    expect(screen.queryByText(/ainda não há posts/i)).toBeNull()
  })
})

describe("Network", () => {
  beforeEach(() => {
    resp.tabelas.setores = ok([{ id: 1, nome: "Tecnologia", nome_en: "Technology" }])
    resp.tabelas.categorias_rede = ok([{ id: 4, nome: "Contabilidade", nome_en: "Accounting" }])
    resp.tabelas.perfis_vitrine = ok([ana])
    resp.rpc.buscar_membros = ok([ana])
    resp.tabelas.network_itens = ok([{ perfil_id: "ana", tipo: "oferece", categoria_id: 4, texto: null }])
  })

  it("Grupo busca pela RPC e mostra o que o membro oferece", async () => {
    mostra(<Network />)
    expect(await screen.findByText("Ana Exemplo")).toBeTruthy()
    expect(screen.getByText("Oferece: Contabilidade")).toBeTruthy()
    expect(chamou("rpc.buscar_membros").length).toBeGreaterThan(0)
    await userEvent.type(screen.getByLabelText("Cidade"), "Cork")
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }))
    await waitFor(() => expect(chamou("rpc.buscar_membros").at(-1)?.args).toMatchObject({ filtro_cidade: "Cork" }))
    await semViolacoes()
  })

  it("Clube: lista pela vitrine, filtros travados, sem RPC", async () => {
    mostra(<Network />, "/pt", { nivel: "clube" })
    expect(await screen.findByText("Ana Exemplo")).toBeTruthy()
    expect(screen.getByLabelText("Cidade").matches(":disabled")).toBe(true)
    expect(screen.getByText(/Conectar: parte do Grupo/)).toBeTruthy()
    expect(chamou("rpc.buscar_membros")).toHaveLength(0)
    await semViolacoes()
  })

  it("Ver mais pede a próxima página com pular=30 e acrescenta, sem esqueleto", async () => {
    const trinta = Array.from({ length: 30 }, (_, i) => ({ ...ana, id: `m${i}`, slug: `m${i}`, nome: `Membro ${i}` }))
    resp.rpc.buscar_membros = ok(trinta)
    mostra(<Network />)
    await userEvent.click(await screen.findByRole("button", { name: "Ver mais" }))
    await waitFor(() => expect(chamou("rpc.buscar_membros").at(-1)?.args).toMatchObject({ pular: 30, limite: 30 }))
    expect(screen.getAllByRole("listitem").length).toBe(60)
  })

  it("sem resultado mostra a frase de vazio", async () => {
    resp.rpc.buscar_membros = ok([])
    mostra(<Network />)
    expect(await screen.findByText(/Nenhum membro com esses filtros/)).toBeTruthy()
  })

  it("Limpar zera os filtros aplicados, refaz a busca sem filtro e esvazia o campo Cidade", async () => {
    mostra(<Network />)
    expect(await screen.findByText("Ana Exemplo")).toBeTruthy()
    const cidade = screen.getByLabelText<HTMLInputElement>("Cidade")
    await userEvent.type(cidade, "Cork")
    await userEvent.selectOptions(screen.getByLabelText("Tipo"), "oferece")
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }))
    await waitFor(() => expect(chamou("rpc.buscar_membros").at(-1)?.args).toMatchObject({ filtro_cidade: "Cork", filtro_tipo: "oferece" }))
    const antes = chamou("rpc.buscar_membros").length
    await userEvent.click(screen.getByRole("button", { name: "Limpar" }))
    await waitFor(() => expect(chamou("rpc.buscar_membros").length).toBeGreaterThan(antes))
    // toEqual ignora chaves undefined: falha se QUALQUER filtro sobrar depois do Limpar.
    expect(chamou("rpc.buscar_membros").at(-1)?.args).toEqual({ limite: 30, pular: 0 })
    expect(cidade.value).toBe("")
    expect(screen.getByLabelText<HTMLSelectElement>("Tipo").value).toBe("")
  })

  it("setores falhando (membros não): mostra o erro e 'Tentar de novo' recarrega só as listas", async () => {
    resp.tabelas.setores = erro("x")
    mostra(<Network />)
    expect(await screen.findByText("Ana Exemplo")).toBeTruthy()
    expect((await screen.findByRole("alert")).textContent).toMatch(/não conseguimos carregar/i)
    expect(screen.queryByRole("option", { name: "Tecnologia" })).toBeNull()
    const buscas = chamou("rpc.buscar_membros").length
    resp.tabelas.setores = ok([{ id: 1, nome: "Tecnologia", nome_en: "Technology" }])
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }))
    expect(await screen.findByRole("option", { name: "Tecnologia" })).toBeTruthy()
    expect(screen.queryByRole("alert")).toBeNull()
    expect(chamou("rpc.buscar_membros")).toHaveLength(buscas) // a lista de membros não foi refeita
  })
})

function perfilNaRota() {
  return render(
    <MemoryRouter initialEntries={["/pt/network/ana-exemplo"]}>
      <Routes><Route path="/:lang/network/:perfil" element={com({}, <NetworkPerfil />)} /></Routes>
    </MemoryRouter>,
  )
}

describe("Network: perfil", () => {
  beforeEach(() => {
    resp.tabelas.perfis_vitrine = ok([ana])
    resp.tabelas.setores = ok([])
    resp.tabelas.categorias_rede = ok([])
    resp.tabelas.network_itens = ok([])
  })

  it("sem conexão: pede; limite 20/24 h aparece com mensagem clara", async () => {
    resp.tabelas.conexoes = ok([])
    resp.escritas["conexoes.insert"] = erro("limite_conexoes")
    perfilNaRota()
    await userEvent.click(await screen.findByRole("button", { name: "Pedir conexão" }))
    await userEvent.click(screen.getByRole("button", { name: "Enviar pedido", hidden: true }))
    expect((await screen.findAllByText(/limite de 20 pedidos/))[0]).toBeTruthy()
    expect(chamou("conexoes.insert")[0].args).toMatchObject({ destinatario_id: "ana", origem: "busca" })
    await semViolacoes()
  })

  it("recusada há menos de 30 dias: sem botão de pedir, diz quando pode de novo", async () => {
    resp.tabelas.conexoes = ok([{ id: 1, solicitante_id: "eu", destinatario_id: "ana", status: "recusada", origem: "busca", mensagem: null, respondida_em: new Date().toISOString(), pedida_em: new Date().toISOString() }])
    perfilNaRota()
    expect(await screen.findByText(/Pedido não aceito/)).toBeTruthy()
    expect(screen.getByText(/Novo pedido a partir de/)).toBeTruthy()
    expect(screen.queryByRole("button", { name: /Pedir conexão/ })).toBeNull()
  })

  it("aceita: oferece 'Ver contato' e chama revelar_contato só no clique", async () => {
    resp.tabelas.conexoes = ok([{ id: 1, solicitante_id: "eu", destinatario_id: "ana", status: "aceita", origem: "busca", mensagem: null, respondida_em: null, pedida_em: new Date().toISOString() }])
    resp.rpc.revelar_contato = ok([{ email_contato: "ana@exemplo.invalid", whatsapp: null }])
    perfilNaRota()
    await userEvent.click(await screen.findByRole("button", { name: "Ver contato" }))
    expect(await screen.findByText("ana@exemplo.invalid")).toBeTruthy()
  })

  it("revelar_contato recusado (42501) vira 'contato indisponível'", async () => {
    resp.tabelas.conexoes = ok([{ id: 1, solicitante_id: "eu", destinatario_id: "ana", status: "aceita", origem: "busca", mensagem: null, respondida_em: null, pedida_em: new Date().toISOString() }])
    resp.rpc.revelar_contato = erro("sem_conexao_aceita", "42501")
    perfilNaRota()
    await userEvent.click(await screen.findByRole("button", { name: "Ver contato" }))
    expect(await screen.findByText(/Contato indisponível/)).toBeTruthy()
  })

  it("perfil que não volta do banco (privado) mostra a frase certa", async () => {
    resp.tabelas.perfis_vitrine = ok([])
    perfilNaRota()
    expect(await screen.findByText(/visível só para membros/)).toBeTruthy()
  })
})

describe("Match", () => {
  const doc = { id: 7, titulo: "Texto do Match", versao: "1", conteudo_md: "Usamos seus dados." }
  beforeEach(() => {
    resp.tabelas.documentos_legais = ok([doc])
    resp.tabelas.consentimentos = ok([])
    resp.tabelas.conexoes = ok([])
    resp.tabelas.setores = ok([])
    resp.tabelas.categorias_rede = ok([])
    resp.tabelas.network_itens = ok([])
  })

  it("primeira vez: pede o opt-in e grava o consentimento com o documento vigente", async () => {
    mostra(<Match />)
    const ativar = await screen.findByRole("button", { name: "Ativar o Match" })
    expect((ativar as HTMLButtonElement).disabled).toBe(true) // só destrava depois de marcar "Li o texto"
    expect(screen.getByText(/aparece nas sugestões de outros membros/)).toBeTruthy()
    await userEvent.click(screen.getByLabelText(/Li o texto do Match \(v1\)/))
    await userEvent.click(ativar)
    await waitFor(() => expect(chamou("consentimentos.insert")[0]?.args).toMatchObject({ documento_id: 7, perfil_id: "eu", evidencia: expect.stringContaining("v1") }))
    await semViolacoes()
  })

  it("sem documento vigente: aviso 'em revisão' e nenhum botão de ligar", async () => {
    resp.tabelas.documentos_legais = ok([])
    mostra(<Match />)
    expect(await screen.findByText(/em revisão/)).toBeTruthy()
    expect(screen.queryByRole("button", { name: /Ativar|Religar/ })).toBeNull()
  })

  it("desligado: explica e deixa religar", async () => {
    resp.tabelas.consentimentos = ok([{ id: 1, revogado_em: "2026-10-01T00:00:00Z" }])
    mostra(<Match />)
    expect(await screen.findByText("Você não recebe sugestões")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Religar" })).toBeTruthy()
  })

  it("ligado sem sugestões: frase da segunda-feira; desligar com UPDATE vazio mostra erro", async () => {
    resp.tabelas.consentimentos = ok([{ id: 1, revogado_em: null }])
    resp.tabelas.sugestoes_match = ok([])
    resp.escritas["consentimentos.update"] = ok([])
    mostra(<Match />)
    expect(await screen.findByText(/saem na segunda-feira/)).toBeTruthy()
    await userEvent.click(screen.getByRole("button", { name: "Desligar o Match" }))
    const d = document.querySelector<HTMLElement>("dialog[open]")!
    await userEvent.click(within(d).getByRole("button", { name: "Desligar o Match", hidden: true }))
    expect((await screen.findByRole("alert")).textContent).toMatch(/continua ligado/)
  })

  it("ligado com sugestão: mostra o motivo e 'Ver perfil'", async () => {
    resp.tabelas.consentimentos = ok([{ id: 1, revogado_em: null }])
    resp.tabelas.sugestoes_match = ok([{ id: 1, sugerido_id: "ana", semana: "2026-10-26", motivo: "oferece Contabilidade", pontuacao: 3 }])
    resp.tabelas.perfis_vitrine = ok([ana])
    mostra(<Match />)
    expect(await screen.findByText("oferece Contabilidade")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Ver perfil" })).toBeTruthy()
    await semViolacoes()
  })

  it("três sugestões, a 1ª com pedido pendente: só a 1ª livre (Bia) tem o 'Pedir conexão' primário; a outra (Caio) é contorno", async () => {
    const bia = { ...ana, id: "bia", nome: "Bia Exemplo", slug: "bia-exemplo" }
    const caio = { ...ana, id: "caio", nome: "Caio Exemplo", slug: "caio-exemplo" }
    resp.tabelas.consentimentos = ok([{ id: 1, revogado_em: null }])
    resp.tabelas.sugestoes_match = ok([
      { id: 1, sugerido_id: "ana", semana: "2026-10-26", motivo: "oferece Contabilidade", pontuacao: 3 },
      { id: 2, sugerido_id: "bia", semana: "2026-10-26", motivo: "mesma cidade", pontuacao: 2 },
      { id: 3, sugerido_id: "caio", semana: "2026-10-26", motivo: "mesmo setor", pontuacao: 1 },
    ])
    resp.tabelas.perfis_vitrine = ok([ana, bia, caio])
    resp.tabelas.conexoes = ok([{ id: 1, solicitante_id: "eu", destinatario_id: "ana", status: "pendente", origem: "match", mensagem: null, respondida_em: null, pedida_em: "2026-10-30T10:00:00Z" }])
    mostra(<Match />)
    expect(await screen.findByText("Caio Exemplo")).toBeTruthy()
    const pedir = screen.getAllByRole("button", { name: "Pedir conexão" })
    expect(pedir).toHaveLength(2)
    const [daBia, doCaio] = ["Bia Exemplo", "Caio Exemplo"].map((n) => pedir.find((b) => screen.getByText(n).closest("li")!.contains(b))!)
    // Fora do LayoutMembro o Botao sai no ramo público (bg-destaque); no app é o dourado (bg-dourado).
    expect(daBia.className).toMatch(/bg-dourado|bg-destaque/)
    expect(doCaio.className).not.toMatch(/bg-dourado|bg-destaque/)
    expect(doCaio.classList.contains("border")).toBe(true)
    expect(within(screen.getByText("Ana Exemplo").closest("li")!).getByText("Pedido enviado")).toBeTruthy()
  })

  it("monta o motivo em EN a partir de motivo_dados", async () => {
    resp.tabelas.consentimentos = ok([{ id: 1, revogado_em: null }])
    resp.tabelas.sugestoes_match = ok([{ id: 1, sugerido_id: "ana", semana: "2026-10-26", motivo: "texto antigo", pontuacao: 3, motivo_dados: { categoria_id: 4, mesma_cidade: true, cidade: "Dublin" } }])
    resp.tabelas.categorias_rede = ok([{ id: 4, nome: "Contabilidade", nome_en: "Accounting" }])
    resp.tabelas.perfis_vitrine = ok([ana])
    mostra(<Match />, "/en")
    expect(await screen.findByText("offers Accounting, which you look for; same city (Dublin)")).toBeTruthy()
  })

  it("Clube vê só a prévia bloqueada, sem ler nada", async () => {
    mostra(<Match />, "/pt", { nivel: "clube" })
    expect(await screen.findByText(/As sugestões fazem parte do Grupo Árvora/)).toBeTruthy()
    expect(chamou("rpc.x")).toHaveLength(0)
    await semViolacoes()
  })
})

describe("Conexões", () => {
  const c = (o: object) => ({ id: 1, solicitante_id: "ana", destinatario_id: "eu", status: "pendente", origem: "match", mensagem: "Oi", respondida_em: null, pedida_em: "2026-10-30T10:00:00Z", ...o })
  beforeEach(() => {
    resp.tabelas.perfis_vitrine = ok([ana])
  })

  it("recebidos: aceitar faz UPDATE de status", async () => {
    resp.tabelas.conexoes = ok([c({})])
    mostra(<Conexoes />)
    expect(await screen.findByText("Oi")).toBeTruthy()
    await userEvent.click(screen.getByRole("button", { name: "Aceitar" }))
    await waitFor(() => expect(chamou("conexoes.update")[0]?.args).toEqual({ status: "aceita" }))
    await semViolacoes()
  })

  it("UPDATE vazio ao aceitar vira erro, não sucesso", async () => {
    resp.tabelas.conexoes = ok([c({})])
    resp.escritas["conexoes.update"] = ok([])
    mostra(<Conexoes />)
    await userEvent.click(await screen.findByRole("button", { name: "Aceitar" }))
    expect((await screen.findAllByRole("alert"))[0].textContent).toMatch(/Não conseguimos concluir/)
  })

  it("abas vazias usam a frase do PRD", async () => {
    resp.tabelas.conexoes = ok([])
    mostra(<Conexoes />)
    expect(await screen.findByText(/Você ainda não tem pedidos/)).toBeTruthy()
    await userEvent.click(screen.getByRole("tab", { name: /Conexões \(0\)/ }))
    expect(screen.getByText(/Ainda não há conexões/)).toBeTruthy()
  })

  it("enviado recusado aparece como 'Pedido não aceito'", async () => {
    resp.tabelas.conexoes = ok([c({ solicitante_id: "eu", destinatario_id: "ana", status: "recusada" })])
    mostra(<Conexoes />)
    await userEvent.click(await screen.findByRole("tab", { name: /Enviados/ }))
    expect(screen.getByText(/Pedido não aceito/)).toBeTruthy()
  })

  it("conexão aceita: 'Ver contato' é botão pequeno (Ghost 40px) ao lado de 'Desfazer'", async () => {
    resp.tabelas.conexoes = ok([c({ status: "aceita" })])
    mostraApp(<Conexoes />)
    await userEvent.click(await screen.findByRole("tab", { name: /Conexões \(1\)/ }))
    const linha = screen.getByText("Ana Exemplo").closest("li")!
    const ver = within(linha).getByRole("button", { name: "Ver contato" })
    const desfazer = within(linha).getByRole("button", { name: "Desfazer conexão" })
    expect(ver.classList.contains("min-h-10")).toBe(true)
    expect(ver.className).not.toContain("min-h-12")
    expect(desfazer.classList.contains("min-h-10")).toBe(true)
    expect(desfazer.parentElement!.contains(ver)).toBe(true) // mesma fileira de ações
  })

  it("Clube vê o cadeado", async () => {
    mostra(<Conexoes />, "/pt", { nivel: "clube" })
    expect(await screen.findByText(/conexões fazem parte do Grupo/)).toBeTruthy()
  })
})

describe("Meu Award", () => {
  const p = { id: 5, edicao_id: 1, categoria_id: 2, nome: "Premiada Exemplo", foto_path: null, historia: "História", video_entrevista_id: null, video_premiacao_id: null, materia_url: null, publicado_em: null }
  beforeEach(() => {
    resp.tabelas.premiados = ok([p])
    resp.tabelas.edicoes = ok([{ id: 1, nome: "Dublin 2025", ano: 2025 }])
    resp.tabelas.categorias_premio = ok([{ id: 2, nome: "Inovação" }])
    resp.rpc.premiado_privado = ok({ alteracao_pendente: null, alteracao_em: null })
  })

  it("quem não é premiado vê 404 e nenhuma leitura", async () => {
    mostra(<MeuAward />, "/pt", { premiado: false })
    expect(await screen.findByText("Página não encontrada")).toBeTruthy()
  })

  it("premiado vê categoria, ano e prévia; pedir alteração chama a RPC só com o que mudou", async () => {
    mostra(<MeuAward />, "/pt", { premiado: true })
    expect(await screen.findByText(/Inovação · Dublin 2025/)).toBeTruthy()
    await userEvent.click(screen.getByRole("button", { name: "Pedir alteração" }))
    await userEvent.type(screen.getByLabelText("Matéria"), "https://exemplo.invalid/m")
    await userEvent.click(screen.getByRole("button", { name: "Enviar pedido" }))
    await waitFor(() => expect(chamou("rpc.pedir_alteracao_premiado")[0]?.args).toEqual({ premiado: 5, campos: { materia_url: "https://exemplo.invalid/m" } }))
    await semViolacoes()
  })

  it("mostra 'alteração em análise' quando há pendência", async () => {
    resp.rpc.premiado_privado = ok({ alteracao_pendente: { historia: "Nova" }, alteracao_em: "2026-10-30T10:00:00Z" })
    mostra(<MeuAward />, "/pt", { premiado: true })
    expect(await screen.findByText("Alteração em análise")).toBeTruthy()
  })
})
