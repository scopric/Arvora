import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import axe from "axe-core"
import { MemoryRouter, Route, Routes } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactElement } from "react"

const falso = vi.hoisted(() => ({ atual: {} as unknown }))
vi.mock("../../../lib/supabase", () => ({
  supabase: new Proxy({}, { get: (_, k) => (falso.atual as Record<string | symbol, unknown>)[k] }),
}))
vi.mock("../../../lib/sessao", () => ({ useAuth: () => ({ sessao: { user: { id: "u1", email: "a@b.com" } }, carregando: false }), sair: vi.fn() }))

import { AcessoContext, type Nivel } from "../../../lib/acesso"
import { chamadas, criarFalso, type Resposta } from "../testeSupabase"
import { Academy } from "./Academy"
import { Aula } from "./Aula"
import { Aulas, BemEstar } from "./Aulas"
import { BemVindo } from "./BemVindo"
import { Inicio } from "./Inicio"
import { Tarefa } from "./Tarefa"
import { Tarefas } from "./Tarefas"

const ok = (data: unknown): Resposta => ({ data, error: null })
const falha: Resposta = { data: null, error: { message: "boom" } }
const em = (min: number) => new Date(Date.now() + min * 60000).toISOString()

function montar(rota: string, tela: ReactElement, url: string, nivel: Nivel = "grupo", extra: object = {}) {
  return render(
    <AcessoContext value={{ carregando: false, erro: false, nivel, premiado: false, equipe: false, papel: null, recarregar: () => {}, ...extra }}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path={`/:lang/${rota}`} element={<main>{tela}</main>} />
        </Routes>
      </MemoryRouter>
    </AcessoContext>,
  )
}
async function violacoes() {
  const r = await axe.run(document.body, { rules: { "color-contrast": { enabled: false } } })
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)
}

const vertical = { nome: "Vendas e negociação", nome_en: "Sales", slug: "vendas", aceita_entregas: true }
const aulaBase = {
  id: 5, slug: "live-x", titulo: "Live de proposta", descricao: null, tipo: "ao_vivo", nivel_minimo: "grupo", inicio_em: em(10), duracao_min: 60,
  vertical_id: 1, modulo_id: null, ordem: 0, agendada_em: em(-1000), materiais_publicados_em: null, verticais: vertical,
}

beforeEach(() => {
  chamadas.length = 0
  localStorage.clear()
})
afterEach(cleanup)

describe("/aulas/:slug ao vivo", () => {
  const sala = (rpc: Resposta, nivel: Nivel = "grupo") => {
    falso.atual = criarFalso({ aulas: ok(aulaBase), "rpc:link_transmissao": rpc })
    return montar("aulas/:slug", <Aula />, "/pt/aulas/live-x", nivel)
  }
  it("ainda_nao_abriu: mostra a data absoluta e a espera, sem botão e sem contagem", async () => {
    sala({ data: null, error: { message: "ainda_nao_abriu" } })
    expect(await screen.findByText(/abre pouco antes do início/i)).toBeTruthy()
    expect(screen.queryByRole("link", { name: /entrar na aula/i })).toBeNull()
    expect(screen.getByText(/Dublin/)).toBeTruthy()
    expect(screen.getByText(/Brasília/)).toBeTruthy()
  })
  it("link liberado: botão 'Entrar na aula' abre fora com rel seguro", async () => {
    sala(ok("https://sala.invalid/abc"))
    const a = await screen.findByRole("link", { name: /entrar na aula/i })
    expect(a.getAttribute("href")).toBe("https://sala.invalid/abc")
    expect(a.getAttribute("rel")).toBe("noopener noreferrer")
    expect(a.getAttribute("target")).toBe("_blank")
  })
  it("link que não é https não vira botão", async () => {
    sala(ok("javascript:alert(1)"))
    expect((await screen.findByRole("alert")).textContent).toMatch(/link indisponível/i)
  })
  it("sem_acesso do banco vira cadeado; falha qualquer vira erro com suporte", async () => {
    sala({ data: null, error: { message: "sem_acesso" } })
    expect(await screen.findByText(/bloqueado: parte do grupo/i)).toBeTruthy()
    cleanup()
    sala({ data: null, error: { message: "boom", code: "XX000" } })
    expect((await screen.findByRole("alert")).textContent).toMatch(/fale com o suporte|falar com o suporte/i)
  })
  it("Clube vê a prévia com cadeado e nem chama a RPC", async () => {
    sala(ok("https://sala.invalid/abc"), "clube")
    expect(await screen.findByText(/bloqueado: parte do grupo/i)).toBeTruthy()
    expect(chamadas.some((c) => c.tabela === "rpc")).toBe(false)
  })
  it("aula inexistente: mensagem, não tela vazia", async () => {
    falso.atual = criarFalso({ aulas: ok(null) })
    montar("aulas/:slug", <Aula />, "/pt/aulas/nada")
    expect(await screen.findByText(/não encontramos esta página/i)).toBeTruthy()
  })
  it("sem violações de acessibilidade (axe)", async () => {
    sala({ data: null, error: { message: "ainda_nao_abriu" } })
    await screen.findByText(/abre pouco antes/i)
    expect(await violacoes()).toEqual([])
  })
})

describe("/aulas/:slug gravada e exercícios", () => {
  const gravada = { ...aulaBase, tipo: "gravada", inicio_em: "2026-10-20T19:00:00Z", materiais_publicados_em: "2026-10-21T10:00:00Z" }
  const exercicio = { id: 9, aula_id: 5, ordem: 1, enunciado_md: "Escreva sua proposta.", prazo_dias: null, aceita_arquivo: false }
  const montarGravada = (extra: Record<string, Resposta>, nivel: Nivel = "grupo") => {
    falso.atual = criarFalso({
      aulas: ok(gravada),
      "rpc:video_da_aula": ok("https://video.invalid/embed/1"),
      progresso_aula: ok(null),
      materiais_aula: ok([{ id: 1, tipo: "resumo", conteudo_md: "Primeiro ponto.\n\nSegundo ponto.", arquivo_path: null }]),
      exercicios: ok([exercicio]),
      entregas: ok([]),
      ...extra,
    })
    return montar("aulas/:slug", <Aula />, "/pt/aulas/live-x#exercicios", nivel)
  }
  it("abre direto na aba Exercícios (âncora) e mostra o enunciado", async () => {
    montarGravada({})
    expect(await screen.findByText("Escreva sua proposta.")).toBeTruthy()
    expect(screen.getByRole("tab", { name: "Exercícios" }).getAttribute("aria-selected")).toBe("true")
  })
  it("sem_acesso da RPC de vídeo: 'vídeo indisponível' e os materiais seguem", async () => {
    montarGravada({ "rpc:video_da_aula": { data: null, error: { message: "sem_acesso", code: "42501" } } })
    expect(await screen.findByText(/não conseguimos abrir este vídeo/i)).toBeTruthy()
    expect(await screen.findByText("Escreva sua proposta.")).toBeTruthy()
  })
  it("erro de rede na RPC de vídeo: Erro com 'tentar de novo', não 'indisponível'", async () => {
    montarGravada({ "rpc:video_da_aula": { data: null, error: { message: "TypeError: Failed to fetch", code: "" } } })
    expect(await screen.findByRole("button", { name: /tentar de novo/i })).toBeTruthy()
    expect(screen.queryByText(/não conseguimos abrir este vídeo/i)).toBeNull()
  })
  it("progresso nunca regride: voltar o vídeo grava a posição mas mantém o maior percentual (inteiro)", async () => {
    montarGravada({ "rpc:video_da_aula": ok("https://video.invalid/a.mp4"), progresso_aula: ok({ percentual: 80, posicao_seg: 70 }), "progresso_aula.update": ok([{ aula_id: 5 }]) })
    const video = (await screen.findByLabelText("Live de proposta")) as HTMLVideoElement
    Object.defineProperty(video, "duration", { value: 90 })
    video.currentTime = 10.4
    fireEvent.pause(video)
    await waitFor(() => expect(chamadas.some((c) => c.tabela === "progresso_aula" && c.metodo === "update")).toBe(true))
    expect(chamadas.find((c) => c.tabela === "progresso_aula")?.args[0]).toEqual({ percentual: 80, posicao_seg: 10 })
    video.currentTime = 85.6
    fireEvent.pause(video)
    await waitFor(() => expect(chamadas.filter((c) => c.tabela === "progresso_aula").length).toBe(2))
    expect(chamadas.filter((c) => c.tabela === "progresso_aula")[1].args[0]).toEqual({ percentual: 95, posicao_seg: 85 })
  })
  it("rascunho do exercício sobrevive à troca de aba", async () => {
    montarGravada({})
    await userEvent.type(await screen.findByLabelText("Sua resposta"), "rascunho meu")
    await userEvent.click(screen.getByRole("tab", { name: "Resumo" }))
    await userEvent.click(screen.getByRole("tab", { name: "Exercícios" }))
    expect((screen.getByLabelText("Sua resposta") as HTMLTextAreaElement).value).toBe("rascunho meu")
  })
  it("INSERT que o RLS barra (resposta vazia) vira erro e o texto digitado fica na tela", async () => {
    montarGravada({ "entregas.insert": ok([]) })
    await userEvent.type(await screen.findByLabelText("Sua resposta"), "meu texto")
    await userEvent.click(screen.getByRole("button", { name: /enviar resposta/i }))
    expect((await screen.findAllByRole("alert"))[0].textContent).toMatch(/não conseguimos enviar/i)
    expect((screen.getByLabelText("Sua resposta") as HTMLTextAreaElement).value).toBe("meu texto")
  })
  it("envio válido insere com o perfil do usuário e confirma", async () => {
    montarGravada({ "entregas.insert": ok([{ id: 1 }]) })
    await userEvent.type(await screen.findByLabelText("Sua resposta"), "meu texto")
    await userEvent.click(screen.getByRole("button", { name: /enviar resposta/i }))
    expect(await screen.findByText("Resposta enviada.")).toBeTruthy()
    expect(chamadas.find((c) => c.metodo === "insert" && c.tabela === "entregas")?.args[0]).toEqual({ exercicio_id: 9, perfil_id: "u1", texto: "meu texto", arquivo_path: null })
  })
  it("texto vazio e sem arquivo: erro de campo, nada é enviado", async () => {
    montarGravada({})
    await userEvent.click(await screen.findByRole("button", { name: /enviar resposta/i }))
    expect((await screen.findAllByRole("alert"))[0].textContent).toMatch(/escreva uma resposta/i)
    expect(chamadas.filter((c) => c.metodo !== "video_da_aula")).toEqual([])
  })
  it("status 'ajustar': devolutiva em destaque e reenvio por UPDATE", async () => {
    const entrega = { id: 3, exercicio_id: 9, texto: "v1", arquivo_path: null, status: "ajustar", devolutiva: "Falta o preço.", enviada_em: "2026-10-22T10:00:00Z", corrigido_em: "2026-10-23T10:00:00Z" }
    montarGravada({ entregas: ok([entrega]), "entregas.update": ok([{ id: 3 }]) })
    expect(await screen.findByText("Falta o preço.")).toBeTruthy()
    const campo = screen.getByLabelText("Sua nova resposta")
    await userEvent.click(screen.getByRole("button", { name: "Reenviar" }))
    expect((await screen.findAllByRole("alert"))[0].textContent).toMatch(/altere a resposta/i) // igual à anterior
    await userEvent.type(campo, " mais")
    await userEvent.click(screen.getByRole("button", { name: "Reenviar" }))
    await waitFor(() => expect(chamadas.some((c) => c.metodo === "update" && c.tabela === "entregas")).toBe(true))
  })
  it("vertical que não aceita entregas (Bem-Estar): enunciado sem formulário", async () => {
    montarGravada({ aulas: ok({ ...gravada, verticais: { ...vertical, aceita_entregas: false } }) })
    expect(await screen.findByText(/envio de respostas não está aberto/i)).toBeTruthy()
    expect(screen.queryByRole("button", { name: /enviar resposta/i })).toBeNull()
  })
  it("falha ao ler a aula: erro com 'tentar de novo'", async () => {
    falso.atual = criarFalso({ aulas: falha })
    montar("aulas/:slug", <Aula />, "/pt/aulas/live-x")
    expect((await screen.findByRole("alert")).textContent).toMatch(/algo deu errado/i)
  })
})

describe("/aulas e /bem-estar", () => {
  const lista = [
    { ...aulaBase, id: 1, slug: "a", titulo: "Aula A", inicio_em: em(60 * 24 * 2) },
    { ...aulaBase, id: 2, slug: "b", titulo: "Aula B", tipo: "gravada", inicio_em: "2026-09-01T10:00:00Z", materiais_publicados_em: "2026-09-02T10:00:00Z" },
  ]
  const respostas = (extra: Record<string, Resposta> = {}) => ({
    verticais: ok([{ id: 1, slug: "vendas", nome: "Vendas", nome_en: null }, { id: 2, slug: "bem-estar", nome: "Bem-Estar", nome_en: null }]),
    aulas: ok(lista),
    progresso_aula: ok([{ aula_id: 2, percentual: 100 }]),
    ...extra,
  })
  it("Grupo: próximas e anteriores, botão .ics e link do Google Agenda só para live futura", async () => {
    falso.atual = criarFalso(respostas())
    montar("aulas", <Aulas />, "/pt/aulas")
    expect(await screen.findByRole("heading", { name: "Próximas aulas" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Aulas anteriores" })).toBeTruthy()
    expect(screen.getAllByRole("button", { name: /\.ics/ }).length).toBe(1)
    expect(screen.getByRole("link", { name: /google agenda/i }).getAttribute("href")).toContain("calendar.google.com")
    expect(screen.getByText("Assistida")).toBeTruthy()
    expect(await violacoes()).toEqual([])
  })
  it("Clube: prévia com cadeado, sem botões de agenda", async () => {
    falso.atual = criarFalso(respostas())
    montar("aulas", <Aulas />, "/pt/aulas", "clube")
    expect(await screen.findByText(/bloqueado: parte do grupo/i)).toBeTruthy()
    expect(screen.queryByRole("button", { name: /\.ics/ })).toBeNull()
  })
  it("falha de leitura: erro, não 'sem aulas'", async () => {
    falso.atual = criarFalso(respostas({ aulas: falha }))
    montar("aulas", <Aulas />, "/pt/aulas")
    expect((await screen.findByRole("alert")).textContent).toMatch(/algo deu errado/i)
    expect(screen.queryByText(/não há aulas/i)).toBeNull()
  })
  it("Bem-Estar: aviso fixo e só a vertical dele (vazia aqui)", async () => {
    falso.atual = criarFalso(respostas())
    montar("bem-estar", <BemEstar />, "/pt/bem-estar")
    expect(await screen.findByText(/não substitui acompanhamento profissional/i)).toBeTruthy()
    expect(screen.queryByText("Aula A")).toBeNull()
    expect(screen.getByText(/não há aulas marcadas/i)).toBeTruthy()
  })
})

describe("/tarefas", () => {
  const ex = (id: number, aceita = true) => ({ id, aula_id: 1, ordem: id, enunciado_md: `Enunciado ${id}`, prazo_dias: null, aceita_arquivo: false, aulas: { slug: "a", titulo: `Aula ${id}`, verticais: { ...vertical, aceita_entregas: aceita } } })
  const ent = (id: number, status: string) => ({ id, exercicio_id: id, texto: "t", arquivo_path: null, status, devolutiva: status === "ajustar" ? "Reveja" : null, enviada_em: "2026-10-20T10:00:00Z", corrigido_em: null })
  it("abas com contagem; abre em 'Ajustar' quando há algo a ajustar; Bem-Estar não vira pendente", async () => {
    falso.atual = criarFalso({ exercicios: ok([ex(1), ex(2), ex(3), ex(4, false)]), entregas: ok([ent(2, "enviada"), ent(3, "ajustar")]) })
    montar("tarefas", <Tarefas />, "/pt/tarefas")
    expect(await screen.findByRole("tab", { name: "Pendentes (1)" })).toBeTruthy()
    expect(screen.getByRole("tab", { name: "Enviadas (1)" })).toBeTruthy()
    expect(screen.getByRole("tab", { name: "Aprovadas (0)" })).toBeTruthy()
    expect(screen.getByRole("tab", { name: "Ajustar (1)" }).getAttribute("aria-selected")).toBe("true")
    expect(within(screen.getByRole("tabpanel")).getByText("Aula 3")).toBeTruthy()
    expect(await violacoes()).toEqual([])
  })
  it("Clube: cadeado", async () => {
    falso.atual = criarFalso({ exercicios: ok([]), entregas: ok([]) })
    montar("tarefas", <Tarefas />, "/pt/tarefas", "clube")
    expect(await screen.findByText(/bloqueado: parte do grupo/i)).toBeTruthy()
  })
  it("detalhe: mostra a devolutiva; id inexistente cai em 'não encontramos'", async () => {
    falso.atual = criarFalso({ exercicios: ok([ex(3)]), entregas: ok([ent(3, "ajustar")]) })
    montar("tarefas/:id", <Tarefa />, "/pt/tarefas/3")
    expect(await screen.findByText("Reveja")).toBeTruthy()
    cleanup()
    falso.atual = criarFalso({ exercicios: ok([]), entregas: ok([]) })
    montar("tarefas/:id", <Tarefa />, "/pt/tarefas/abc")
    expect(await screen.findByText(/não encontramos esta página/i)).toBeTruthy()
  })
})

describe("/inicio", () => {
  const base = (extra: Record<string, Resposta> = {}) => ({
    "aulas.single": ok(aulaBase), aulas: ok([{ id: 1, slug: "a", titulo: "Aula A" }]), progresso_aula: ok([]), salvos: ok([]), sugestoes_match: ok([]), conexoes: { data: null, error: null, count: 2 },
    perfis: ok({ onboarding_em: "2026-10-01T00:00:00Z" }), ...extra,
  })
  it("conta nova (sem onboarding) orienta os 3 primeiros passos", async () => {
    falso.atual = criarFalso(base({ perfis: ok({ onboarding_em: null }) }))
    montar("inicio", <Inicio />, "/pt/inicio")
    expect(await screen.findByText("Comece por aqui")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Começar" }).getAttribute("href")).toBe("/pt/bem-vindo")
  })
  it("Clube: próxima aula e sugestões viram prévia bloqueada, sem consultar o Match", async () => {
    falso.atual = criarFalso(base())
    montar("inicio", <Inicio />, "/pt/inicio", "clube")
    expect((await screen.findAllByText(/bloqueado: parte do grupo/i)).length).toBe(1)
    expect(screen.queryByText(/pedido/i)).toBeNull()
  })
  it("um bloco que falha mostra erro só nele; os outros seguem", async () => {
    falso.atual = criarFalso(base({ salvos: falha }))
    montar("inicio", <Inicio />, "/pt/inicio")
    expect((await screen.findByRole("alert")).textContent).toMatch(/algo deu errado/i)
    expect(await screen.findByText("2 pedidos de conexão")).toBeTruthy()
  })
  it("premiado vê Meu Award", async () => {
    falso.atual = criarFalso(base())
    montar("inicio", <Inicio />, "/pt/inicio", "grupo", { premiado: true })
    expect(await screen.findByRole("link", { name: /abrir o meu award/i })).toBeTruthy()
  })
})

describe("/bem-vindo", () => {
  const base = (extra: Record<string, Resposta | (() => Resposta)> = {}) => ({
    perfis: ok({ nome: "Ana", empresa_nome: null, setor_id: null, cidade: null, pais: null, visibilidade: "membros" }),
    setores: ok([{ id: 1, nome: "Educação", nome_en: null }]),
    categorias_rede: ok([{ id: 1, nome: "Clientes", nome_en: null }, { id: 2, nome: "Parceiros", nome_en: null }]),
    network_itens: ok([]), aulas: ok(aulaBase), ...extra,
  })
  it("UPDATE do perfil que o RLS barra (vazio) não avança de passo", async () => {
    falso.atual = criarFalso(base({ "perfis.update": ok([]) }))
    montar("bem-vindo", <BemVindo />, "/pt/bem-vindo")
    await userEvent.click(await screen.findByRole("button", { name: "Continuar" }))
    expect((await screen.findAllByRole("alert"))[0].textContent).toMatch(/não conseguimos salvar/i)
    expect(screen.queryByText(/escolha o que faz sentido/i)).toBeNull()
  })
  it("Grupo: percorre os 3 passos, grava procura/oferece e marca o onboarding", async () => {
    // Antes do upsert network_itens está vazio; depois dele, a leitura de conferência devolve o que ficou gravado.
    falso.atual = criarFalso(base({
      "perfis.update": ok([{ id: "u1" }]),
      "network_itens.upsert": ok(null),
      network_itens: () => ok(!chamadas.some((c) => c.metodo === "upsert") ? [] : [{ id: 1, tipo: "procura", categoria_id: 1 }, { id: 2, tipo: "oferece", categoria_id: 2 }]),
    }))
    montar("bem-vindo", <BemVindo />, "/pt/bem-vindo")
    await userEvent.click(await screen.findByRole("button", { name: "Continuar" }))
    const busco = await screen.findByRole("group", { name: "Busco" })
    await userEvent.click(within(busco).getByRole("checkbox", { name: "Clientes" }))
    const oferece = screen.getByRole("group", { name: "Ofereço" })
    await userEvent.click(within(oferece).getByRole("checkbox", { name: "Parceiros" }))
    expect(await violacoes()).toEqual([])
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }))
    expect(await screen.findByText("Live de proposta")).toBeTruthy()
    expect(chamadas.find((c) => c.tabela === "network_itens" && c.metodo === "upsert")?.args[0]).toEqual([
      { tipo: "procura", categoria_id: 1 },
      { tipo: "oferece", categoria_id: 2 },
    ])
    await userEvent.click(screen.getByRole("button", { name: "Concluir" }))
    await waitFor(() => expect(chamadas.filter((c) => c.tabela === "perfis" && c.metodo === "update").length).toBe(2))
    expect(chamadas.filter((c) => c.tabela === "perfis" && c.metodo === "update")[1].args[0]).toHaveProperty("onboarding_em")
  })
  it("etapa 2: se o banco não ficou como o escolhido, mostra erro e não avança", async () => {
    falso.atual = criarFalso(base({ "perfis.update": ok([{ id: "u1" }]), "network_itens.upsert": ok(null) })) // leitura sempre vazia
    montar("bem-vindo", <BemVindo />, "/pt/bem-vindo")
    await userEvent.click(await screen.findByRole("button", { name: "Continuar" }))
    await userEvent.click(within(await screen.findByRole("group", { name: "Busco" })).getByRole("checkbox", { name: "Clientes" }))
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }))
    expect((await screen.findAllByRole("alert"))[0].textContent).toMatch(/não conseguimos salvar suas escolhas/i)
    expect(screen.queryByText("Live de proposta")).toBeNull()
  })
  it("Clube: passo 2 vira 'Conheça a rede' (sem escrever em network_itens) e o 3 é cadeado", async () => {
    falso.atual = criarFalso(base({ "perfis.update": ok([{ id: "u1" }]) }))
    montar("bem-vindo", <BemVindo />, "/pt/bem-vindo", "clube")
    await userEvent.click(await screen.findByRole("button", { name: "Continuar" }))
    expect(await screen.findByRole("link", { name: "Ver a rede" })).toBeTruthy()
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }))
    expect(await screen.findByText(/bloqueado: parte do grupo/i)).toBeTruthy()
    expect(chamadas.some((c) => c.tabela === "network_itens")).toBe(false)
  })
})

describe("/academy", () => {
  it("Clube vê todos os cursos, com cadeado nos do Grupo; falha vira erro", async () => {
    falso.atual = criarFalso({ cursos: ok([{ id: 1, slug: "f", titulo: "Fundamentos", descricao: null, capa_path: null, nivel_minimo: "grupo", vertical_id: 1, verticais: vertical }]) })
    montar("academy", <Academy />, "/pt/academy", "clube")
    expect(await screen.findByRole("link", { name: "Fundamentos" })).toBeTruthy()
    expect(screen.getByText("Parte do Grupo Árvora")).toBeTruthy()
    cleanup()
    falso.atual = criarFalso({ cursos: falha })
    montar("academy", <Academy />, "/pt/academy")
    expect((await screen.findByRole("alert")).textContent).toMatch(/algo deu errado/i)
  })
})
