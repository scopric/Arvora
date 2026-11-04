import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { FunctionsHttpError } from "@supabase/supabase-js"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../../../lib/supabase", async () => ({ supabase: (await import("./mockSupabase")).supabase }))
vi.mock("../../../lib/sessao", () => ({ useAuth: () => ({ sessao: { user: { id: "eu" } }, carregando: false }), sair: vi.fn() }))

import { simularDialog } from "../../../testeUtil"
import { ConsentimentoHof } from "../componentes/ConsentimentoHof"
import { AulaForm } from "../telas/AulaForm"
import { Correcao } from "../telas/Correcao"
import { Empresas } from "../telas/Empresas"
import { Equipe } from "../telas/Equipe"
import { Membros } from "../telas/Membros"
import { Moderacao } from "../telas/Moderacao"
import { PedidosDeDados } from "../telas/PedidosDeDados"
import { Premiado } from "../telas/Premiado"
import { RelatorioCiclo } from "../telas/RelatorioCiclo"
import { Temas } from "../telas/Temas"
import { VisaoGeral } from "../telas/VisaoGeral"
import { REL } from "./fixtures"
import { chamou, estado, reiniciar } from "./mockSupabase"
import { montar } from "./util"

simularDialog()
beforeEach(() => {
  reiniciar()
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-10-31T12:00:00Z"))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const texto = () => document.body.textContent!.replace(/ /g, " ")

describe("Relatório do Ciclo", () => {
  async function abrirCiclo(ciclo: string) {
    montar(<RelatorioCiclo />, "/relatorio-ciclo", "/pt/admin/relatorio-ciclo")
    await screen.findByText(/1\. Receita/)
    fireEvent.change(screen.getByLabelText(/Mês em que o Ciclo/), { target: { value: ciclo.slice(0, 7) } })
    await screen.findByText(/1\. Receita/)
  }

  it("mostra os números do banco, sem recalcular", async () => {
    estado.respostas["relatorios_ciclo"] = { data: [], error: null }
    estado.respostas["rpc:relatorio_ciclo"] = { data: REL, error: null }
    montar(<RelatorioCiclo />, "/relatorio-ciclo", "/pt/admin/relatorio-ciclo")
    await screen.findByText(/1\. Receita/)
    const t = texto()
    for (const v of ["1.000,00", "250,00", "1.250,00", "100,00", "45,00", "145,00", "1.105,00", "30,00", "20,00", "50,00"]) expect(t).toContain(v)
    expect(t).toContain("Clientes Ativos42")
    expect(screen.getByText("Rascunho", { selector: "span" })).toBeTruthy()
    expect(chamou("rpc:relatorio_ciclo")[0].args[0]).toEqual({ ciclo_inicio: "2026-10-10" })
  })

  it("fechar o Ciclo pede confirmação e chama fechar_ciclo com o Ciclo escolhido", async () => {
    estado.respostas["relatorios_ciclo"] = { data: [], error: null }
    estado.respostas["rpc:relatorio_ciclo"] = { data: REL, error: null }
    await abrirCiclo("2026-09-10")
    await userEvent.click(screen.getByRole("button", { name: "Fechar o Ciclo" }))
    await userEvent.click(within(document.querySelector("dialog[open]") as HTMLElement).getByRole("button", { name: "Fechar o Ciclo", hidden: true }))
    await waitFor(() => expect(chamou("rpc:fechar_ciclo")).toHaveLength(1))
    expect(chamou("rpc:fechar_ciclo")[0].args[0]).toEqual({ ciclo_inicio: "2026-09-10" })
  })

  it("Ciclo em andamento ou com pendência de câmbio não deixa fechar", async () => {
    estado.respostas["relatorios_ciclo"] = { data: [], error: null }
    estado.respostas["rpc:relatorio_ciclo"] = { data: { ...REL, pendencias: [{ tipo: "cambio_ausente", moeda: "BRL" }] }, error: null }
    await abrirCiclo("2026-09-10")
    expect((screen.getByRole("button", { name: "Fechar o Ciclo" }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/Falta taxa do BCE: BRL/)).toBeTruthy()
  })

  it("erro do banco ao fechar aparece claro", async () => {
    estado.respostas["relatorios_ciclo"] = { data: [], error: null }
    estado.respostas["rpc:relatorio_ciclo"] = { data: REL, error: null }
    estado.respostas["rpc:fechar_ciclo"] = { data: null, error: { message: "ciclo_com_pendencias", code: "P0001" } }
    await abrirCiclo("2026-09-10")
    await userEvent.click(screen.getByRole("button", { name: "Fechar o Ciclo" }))
    await userEvent.click(within(document.querySelector("dialog[open]") as HTMLElement).getByRole("button", { name: "Fechar o Ciclo", hidden: true }))
    expect((await screen.findAllByRole("alert")).map((a) => a.textContent).join(" ")).toMatch(/tem pendências/)
  })

  it("Ciclo fechado mostra a versão congelada e não recalcula", async () => {
    const fechado = { ...REL, ciclo: { ...REL.ciclo, estado: "fechado" as const, ultima_versao: 1 } }
    estado.respostas["relatorios_ciclo"] = { data: [{ versao: 1, dados: fechado, enviado_em: null, reaberto_em: null, motivo_reabertura: null, csv_sha256: "abc123", criado_em: "2026-10-10T00:00:00Z" }], error: null }
    estado.respostas["rpc:relatorio_ciclo"] = { data: { ...REL, receita_base: 1 }, error: null }
    await abrirCiclo("2026-09-10")
    expect(screen.getByText("Fechado", { selector: "span" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Fechar o Ciclo" })).toBeNull()
    expect(screen.getByRole("button", { name: "Marcar como enviado" })).toBeTruthy()
    expect(texto()).toContain("1.105,00")
    expect(chamou("rpc:relatorio_ciclo").filter((c) => (c.args[0] as { ciclo_inicio: string }).ciclo_inicio === "2026-09-10")).toHaveLength(0)
  })

  it("auditor só lê: sem botões de escrita", async () => {
    estado.respostas["relatorios_ciclo"] = { data: [], error: null }
    estado.respostas["rpc:relatorio_ciclo"] = { data: REL, error: null }
    montar(<RelatorioCiclo />, "/relatorio-ciclo", "/pt/admin/relatorio-ciclo", "auditor")
    await screen.findByText(/1\. Receita/)
    expect(screen.queryByRole("button", { name: "Fechar o Ciclo" })).toBeNull()
    expect(screen.queryByText("Lançar receita fora do Stripe")).toBeNull()
    expect(screen.getByRole("button", { name: "Baixar CSV" })).toBeTruthy()
  })

  it("editor não vê o relatório", async () => {
    montar(<RelatorioCiclo />, "/relatorio-ciclo", "/pt/admin/relatorio-ciclo", "editor")
    expect(await screen.findByText("Sem acesso a esta tela")).toBeTruthy()
  })
})

describe("Correção de tarefas", () => {
  beforeEach(() => {
    estado.respostas["entregas"] = { data: [{ id: 5, exercicio_id: 2, perfil_id: "p1", texto: "Minha resposta", arquivo_path: null, enviada_em: "2026-10-25T10:00:00Z" }], error: null }
    estado.respostas["exercicios"] = { data: [{ id: 2, aula_id: 3, enunciado_md: "Descreva sua meta" }], error: null }
    estado.respostas["aulas"] = { data: [{ id: 3, titulo: "Aula de vendas" }], error: null }
    estado.respostas["perfis"] = { data: [{ id: "p1", nome: "Ana Exemplo" }], error: null }
  })
  it("pedir ajuste sem devolutiva é barrado na tela; com texto chama corrigir_entrega", async () => {
    montar(<Correcao />, "/correcao", "/pt/admin/correcao", "corretor")
    await screen.findByText(/Ana Exemplo · Aula de vendas/)
    await userEvent.click(screen.getByRole("button", { name: "Pedir ajuste" }))
    expect(await screen.findByText("Escreva a devolutiva para pedir ajuste.")).toBeTruthy()
    expect(chamou("rpc:corrigir_entrega")).toHaveLength(0)
    await userEvent.type(screen.getByLabelText("Devolutiva"), "Detalhe mais a meta")
    await userEvent.click(screen.getByRole("button", { name: "Pedir ajuste" }))
    await waitFor(() => expect(chamou("rpc:corrigir_entrega")).toHaveLength(1))
    expect(chamou("rpc:corrigir_entrega")[0].args[0]).toEqual({ entrega: 5, novo_status: "ajustar", devolutiva: "Detalhe mais a meta" })
  })
  it("só a primeira entrega da fila leva o 'Aprovar' dourado; as outras ficam em cinza", async () => {
    estado.respostas["entregas"] = { data: [
      { id: 5, exercicio_id: 2, perfil_id: "p1", texto: "A", arquivo_path: null, enviada_em: "2026-10-25T10:00:00Z" },
      { id: 6, exercicio_id: 2, perfil_id: "p1", texto: "B", arquivo_path: null, enviada_em: "2026-10-26T10:00:00Z" },
    ], error: null }
    montar(<Correcao />, "/correcao", "/pt/admin/correcao", "corretor")
    const aprovar = await screen.findAllByRole("button", { name: "Aprovar" })
    expect(aprovar).toHaveLength(2)
    // No teste o Botao renderiza o ramo público (sem .app): o primário é bg-destaque; no app é bg-dourado.
    expect(aprovar[0].className).toMatch(/bg-dourado|bg-destaque/)
    expect(aprovar[1].className).not.toMatch(/bg-dourado|bg-destaque/)
  })
  it("mostra o prazo de entrega do exercício, sem marcar atraso", async () => {
    estado.respostas["exercicios"] = { data: [{ id: 2, aula_id: 3, enunciado_md: "Descreva sua meta", prazo_dias: 3 }], error: null }
    montar(<Correcao />, "/correcao", "/pt/admin/correcao", "corretor")
    await screen.findByText(/Ana Exemplo · Aula de vendas/)
    expect(screen.getByText(/Prazo de entrega: 3 dia\(s\)/)).toBeTruthy()
    expect(screen.queryByText("Atrasada")).toBeNull()
  })
  it("fila vazia diz 'fila zerada'; editor não tem a tela", async () => {
    estado.respostas["entregas"] = { data: [], error: null }
    montar(<Correcao />, "/correcao", "/pt/admin/correcao")
    expect(await screen.findByText("Fila zerada.")).toBeTruthy()
    cleanup()
    montar(<Correcao />, "/correcao", "/pt/admin/correcao", "editor")
    expect(await screen.findByText("Sem acesso a esta tela")).toBeTruthy()
  })
})

describe("Empresas", () => {
  it("aprovar chama aprovar_empresa; recusar pede confirmação", async () => {
    estado.respostas["rpc:empresas_equipe"] = { data: [{ id: 9, nome: "Padaria Exemplo", cidade: "Dublin", pais: "IE", site: null, descricao: "Pães", setor_id: 1, status: "pendente", criado_em: "2026-10-01T00:00:00Z" }], error: null }
    montar(<Empresas />, "/empresas", "/pt/admin/empresas", "moderador")
    await screen.findByText("Padaria Exemplo")
    await userEvent.click(screen.getByRole("button", { name: "Aprovar" }))
    await waitFor(() => expect(chamou("rpc:aprovar_empresa")).toHaveLength(1))
    expect(chamou("rpc:aprovar_empresa")[0].args[0]).toEqual({ empresa: 9, aprovar: true, motivo: null })
    await userEvent.click(screen.getByRole("button", { name: "Recusar" }))
    expect(chamou("rpc:aprovar_empresa")).toHaveLength(1)
    const dialogo = within(document.querySelector("dialog[open]") as HTMLElement)
    expect((dialogo.getByRole("button", { name: "Recusar", hidden: true }) as HTMLButtonElement).disabled).toBe(true)
    await userEvent.type(dialogo.getByLabelText(/Motivo da recusa/), "Sem site")
    await userEvent.click(dialogo.getByRole("button", { name: "Recusar", hidden: true }))
    await waitFor(() => expect(chamou("rpc:aprovar_empresa")).toHaveLength(2))
    expect(chamou("rpc:aprovar_empresa")[1].args[0]).toEqual({ empresa: 9, aprovar: false, motivo: "Sem site" })
  })
})

describe("Aula", () => {
  const aula = { id: 3, modulo_id: null, vertical_id: 1, tipo: "gravada", titulo: "Aula de vendas", slug: "aula-de-vendas", descricao: null, nivel_minimo: "grupo", ordem: 0, inicio_em: null, duracao_min: 45, trailer_video_id: null, agendada_em: null, materiais_publicados_em: null }
  beforeEach(() => {
    estado.respostas["aulas"] = { data: aula, error: null }
    estado.respostas["rpc:video_da_aula"] = { data: "vid-123", error: null }
  })
  it("UPDATE sem linha (RLS) vira erro, não 'Agendada'", async () => {
    estado.respostas["aulas:update"] = { data: [], error: null }
    montar(<AulaForm />, "/aulas/:id", "/pt/admin/aulas/3")
    await screen.findByDisplayValue("Aula de vendas")
    expect((screen.getByLabelText(/Gravação/) as HTMLInputElement).value).toBe("vid-123")
    await userEvent.click(screen.getByRole("button", { name: "Agendar" }))
    expect((await screen.findAllByRole("alert")).map((a) => a.textContent).join(" ")).toMatch(/Nenhuma linha foi alterada/)
    expect(screen.queryByText(/Aula agendada/)).toBeNull()
  })
  it("agendar grava agendada_em; publicar fica bloqueado com material em rascunho", async () => {
    estado.respostas["aulas:update"] = { data: [{ id: 3 }], error: null }
    estado.respostas["materiais_aula"] = { data: [{ id: 1, tipo: "resumo", conteudo_md: "texto", arquivo_path: null, status: "rascunho" }], error: null }
    montar(<AulaForm />, "/aulas/:id", "/pt/admin/aulas/3")
    await screen.findByDisplayValue("Aula de vendas")
    expect((screen.getByRole("button", { name: "Publicar materiais" }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/Há material em rascunho/)).toBeTruthy()
    await userEvent.click(screen.getByRole("button", { name: "Agendar" }))
    await waitFor(() => expect(chamou("aulas", "update")).toHaveLength(1))
    expect(Object.keys(chamou("aulas", "update")[0].args[0] as object)).toEqual(["agendada_em"])
  })
  it("aprovar material chama aprovar_material", async () => {
    estado.respostas["materiais_aula"] = { data: [{ id: 11, tipo: "ebook", conteudo_md: "x", arquivo_path: null, status: "rascunho" }], error: null }
    montar(<AulaForm />, "/aulas/:id", "/pt/admin/aulas/3")
    await userEvent.click(await screen.findByRole("button", { name: "Aprovar para publicar" }))
    await waitFor(() => expect(chamou("rpc:aprovar_material")).toHaveLength(1))
    expect(chamou("rpc:aprovar_material")[0].args[0]).toEqual({ material: 11 })
  })
  it("Criar sala no Google Meet preenche o link principal; função sem segredo mostra mensagem clara", async () => {
    estado.respostas["aulas"] = { data: { ...aula, tipo: "ao_vivo" }, error: null }
    estado.respostas["fn:criar-sala-meet"] = { data: { url: "https://meet.google.com/abc-defg-hij" }, error: null }
    montar(<AulaForm />, "/aulas/:id", "/pt/admin/aulas/3")
    await userEvent.click(await screen.findByRole("button", { name: "Criar sala no Google Meet" }))
    await waitFor(() => expect((screen.getByLabelText(/Link principal/) as HTMLInputElement).value).toBe("https://meet.google.com/abc-defg-hij"))
    expect(await screen.findByText(/Sala criada/)).toBeTruthy()
    estado.respostas["fn:criar-sala-meet"] = { data: null, error: new FunctionsHttpError(new Response(JSON.stringify({ erro: "meet_nao_configurado" }), { status: 503 })) }
    await userEvent.click(screen.getByRole("button", { name: "Criar sala no Google Meet" }))
    expect((await screen.findAllByRole("alert")).map((a) => a.textContent).join(" ")).toMatch(/Google Meet ainda não está configurado/)
  })
  it("sem video_da_aula por erro de permissão a tela mostra erro e não um formulário vazio", async () => {
    estado.respostas["rpc:video_da_aula"] = { data: null, error: { code: "42501", message: "sem_acesso" } }
    montar(<AulaForm />, "/aulas/:id", "/pt/admin/aulas/3")
    expect(await screen.findByText(/Não conseguimos carregar/)).toBeTruthy()
  })
})

describe("Pedidos de dados, Equipe, Membros, Visão geral, Temas, Moderação", () => {
  it("pedido vencido leva selo; quem não é super_admin não vê a fila", async () => {
    estado.respostas["pedidos_gdpr"] = { data: [{ id: 1, email: "x@exemplo.invalid", tipo: "exclusao", status: "recebido", prazo_em: "2026-10-01", observacao: null }], error: null }
    montar(<PedidosDeDados />, "/pedidos-de-dados", "/pt/admin/pedidos-de-dados")
    expect(await screen.findByText("Vencido")).toBeTruthy()
    cleanup()
    montar(<PedidosDeDados />, "/pedidos-de-dados", "/pt/admin/pedidos-de-dados", "editor")
    expect(await screen.findByText("Sem acesso a esta tela")).toBeTruthy()
  })
  it("marcar como atendido pede confirmação antes de gravar", async () => {
    estado.respostas["pedidos_gdpr"] = { data: [{ id: 1, email: "x@exemplo.invalid", tipo: "exclusao", status: "recebido", prazo_em: "2026-11-20", criado_em: "2026-10-20T10:00:00Z", observacao: null }], error: null }
    montar(<PedidosDeDados />, "/pedidos-de-dados", "/pt/admin/pedidos-de-dados")
    await screen.findByText("x@exemplo.invalid")
    await userEvent.click(screen.getByRole("button", { name: "Marcar como atendido" }))
    expect(chamou("pedidos_gdpr", "update")).toHaveLength(0)
    await userEvent.click(await screen.findByRole("button", { name: "Cancelar" }))
    expect(chamou("pedidos_gdpr", "update")).toHaveLength(0)
    await userEvent.click(screen.getByRole("button", { name: "Marcar como atendido" }))
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Marcar como atendido" }))
    await waitFor(() => expect(chamou("pedidos_gdpr", "update")).toHaveLength(1))
    expect(chamou("pedidos_gdpr", "update")[0].args[0]).toMatchObject({ status: "concluido" })
  })
  it("Equipe: só o super_admin", async () => {
    montar(<Equipe />, "/equipe", "/pt/admin/equipe", "auditor")
    expect(await screen.findByText("Sem acesso a esta tela")).toBeTruthy()
  })
  it("Membros: coluna de plano só para o financeiro", async () => {
    estado.respostas["perfis"] = { data: [{ id: "p1", nome: "Ana Exemplo", empresa_nome: null, cidade: null, pais: null, visibilidade: "membros", suspenso_em: null, criado_em: "2026-01-01T00:00:00Z" }], error: null }
    estado.respostas["assinaturas"] = { data: [{ perfil_id: "p1", plano_id: 1, status: "active", periodo_fim: "2027-01-01T00:00:00Z" }], error: null }
    estado.respostas["planos"] = { data: [{ id: 1, nivel: "grupo" }], error: null }
    montar(<Membros />, "/membros", "/pt/admin/membros", "auditor")
    await screen.findByText("Ana Exemplo")
    expect(screen.getByText(/Grupo Árvora · Ativa/)).toBeTruthy()
    cleanup()
    montar(<Membros />, "/membros", "/pt/admin/membros", "moderador")
    await screen.findByText("Ana Exemplo")
    expect(screen.queryByText(/Plano e situação/)).toBeNull()
  })
  it("Membros: Enter no campo de busca envia a Barra e consulta pelo nome", async () => {
    estado.respostas["perfis"] = { data: [{ id: "p1", nome: "Ana Exemplo", empresa_nome: null, cidade: null, pais: null, visibilidade: "membros", suspenso_em: null, criado_em: "2026-01-01T00:00:00Z" }], error: null }
    montar(<Membros />, "/membros", "/pt/admin/membros", "moderador")
    await screen.findByText("Ana Exemplo")
    const antes = chamou("perfis").length
    await userEvent.type(screen.getByLabelText("Buscar por nome"), "Ana{Enter}")
    await waitFor(() => expect(chamou("perfis").length).toBeGreaterThan(antes))
    expect(screen.getByRole("button", { name: "Filtrar" }).closest("form")).not.toBeNull()
  })
  it("Visão geral: cada papel vê só os cartões em que pode agir", async () => {
    for (const t of ["empresas", "denuncias", "pedidos_gdpr", "aulas", "entregas", "premiados"]) estado.respostas[t] = { data: null, count: 3, error: null }
    montar(<VisaoGeral />, "", "/pt/admin", "corretor")
    expect(await screen.findByText("Entregas na fila de correção")).toBeTruthy()
    expect(screen.queryByText("Denúncias abertas")).toBeNull()
    cleanup()
    montar(<VisaoGeral />, "", "/pt/admin", "editor")
    expect(await screen.findByText("Empresas a aprovar")).toBeTruthy()
    expect(screen.queryByText("Entregas na fila de correção")).toBeNull()
  })
  it("Visão geral zerada diz 'Nada pendente'", async () => {
    for (const t of ["empresas", "denuncias", "pedidos_gdpr", "aulas", "entregas", "premiados"]) estado.respostas[t] = { data: null, count: 0, error: null }
    montar(<VisaoGeral />, "", "/pt/admin", "super_admin")
    expect(await screen.findByText("Nada pendente.")).toBeTruthy()
  })
  it("cadastro genérico: UPDATE que não casa linha vira erro", async () => {
    estado.respostas["temas"] = { data: [{ id: 1, nome: "Liderança", nome_en: null, slug: "lideranca", ordem: 1 }], error: null }
    estado.respostas["temas:update"] = { data: [], error: null }
    montar(<Temas />, "/temas", "/pt/admin/temas", "editor")
    await userEvent.click(await screen.findByRole("button", { name: "Editar" }))
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }))
    expect((await screen.findAllByRole("alert")).map((a) => a.textContent).join(" ")).toMatch(/Nenhuma linha foi alterada/)
  })
  it("Moderação: marcar denúncia como procedente chama resolver_denuncia", async () => {
    estado.respostas["denuncias"] = { data: [{ id: 5, motivo: "Spam", texto: null, criado_em: "2026-10-30T10:00:00Z", perfil_denunciado_id: null, post_id: 8, comentario_id: null, empresa_id: null, conexao_id: null }], error: null }
    estado.respostas["posts"] = { data: [{ id: 8, corpo: "Compre agora", autor_id: "p9", oculto_em: null }], error: null }
    montar(<Moderacao />, "/moderacao", "/pt/admin/moderacao", "moderador")
    await screen.findByText("Compre agora")
    await userEvent.click(screen.getByRole("button", { name: "Procedente" }))
    await waitFor(() => expect(chamou("rpc:resolver_denuncia")).toHaveLength(1))
    expect(chamou("rpc:resolver_denuncia")[0].args[0]).toEqual({ denuncia: 5, procedente: true })
  })
  it("Moderação: aprovar perfil envia a versão lida; perfil alterado no meio mostra o aviso e recarrega", async () => {
    estado.respostas["denuncias"] = { data: [], error: null }
    estado.respostas["perfis"] = { data: [{ id: "p1", nome: "Bia", empresa_nome: null, cidade: null, bio: null, atualizado_em: "2026-10-30T10:00:00.123456+00:00" }], error: null }
    estado.respostas["rpc:aprovar_perfil_publico"] = { data: null, error: { code: "P0001", message: "perfil_mudou" } }
    montar(<Moderacao />, "/moderacao", "/pt/admin/moderacao", "moderador")
    await userEvent.click(await screen.findByRole("tab", { name: "Perfis públicos" }))
    await userEvent.click(await screen.findByRole("button", { name: "Aprovar perfil público" }))
    await waitFor(() => expect(chamou("rpc:aprovar_perfil_publico")).toHaveLength(1))
    expect(chamou("rpc:aprovar_perfil_publico")[0].args[0]).toEqual({ perfil: "p1", versao: "2026-10-30T10:00:00.123456+00:00", aprovar: true })
    expect(await screen.findByText(/O membro alterou o perfil/)).toBeTruthy()
    await waitFor(() => expect(chamou("perfis").length).toBeGreaterThan(1))
  })
})

describe("Receitas fora do Stripe, estorno, acesso manual e câmbio", () => {
  const RECEITA = { id: 3, cliente_nome: "Cliente Pix", plano_id: 7, perfil_id: null, moeda: "EUR", bruto_centavos: 25000, recebido_em: "2026-09-20" }
  async function abrir() {
    estado.respostas["relatorios_ciclo"] = { data: [], error: null }
    estado.respostas["rpc:relatorio_ciclo"] = { data: REL, error: null }
    estado.respostas["planos"] = { data: [{ id: 7, nome: "Grupo Anual" }], error: null }
    estado.respostas["receitas_externas:select"] = { data: [RECEITA], error: null }
    estado.respostas["receitas_externas:insert"] = { data: [{ id: 9 }], error: null }
    montar(<RelatorioCiclo />, "/relatorio-ciclo", "/pt/admin/relatorio-ciclo")
    await screen.findByText(/1\. Receita/)
    fireEvent.change(screen.getByLabelText(/Mês em que o Ciclo/), { target: { value: "2026-09" } })
    await screen.findByText(/1\. Receita/)
    await screen.findByRole("option", { name: "Grupo Anual" })
  }
  // Cada formulário é achado pelo botão de enviar; rótulos são regex ancoradas no começo.
  const preencher = async (campos: Record<string, string>, botao = "Lançar receita") => {
    const form = screen.getByRole("button", { name: botao }).closest("form") as HTMLElement
    for (const [rotulo, v] of Object.entries(campos)) {
      const el = within(form).getByLabelText(new RegExp(rotulo.startsWith("^") ? rotulo : `^${rotulo}`))
      if (el.tagName === "SELECT") await userEvent.selectOptions(el, v)
      else fireEvent.change(el, { target: { value: v } })
    }
  }
  const comprovante = () => userEvent.upload(screen.getByLabelText(/^Comprovante/), new File(["x"], "comp.pdf", { type: "application/pdf" }))
  const base = { "Recebido em": "2026-09-20", Cliente: "Ana", "Valor bruto": "100,00", "Plano": "7" }
  const alerta = async (re: RegExp) => { await waitFor(() => expect(screen.getAllByRole("alert").map((a) => a.textContent).join(" ")).toMatch(re)) }

  it("lançar receita valida tudo ANTES do upload (moeda, VAT, data do Ciclo, plano)", async () => {
    await abrir()
    await comprovante()
    await preencher({ "Recebido em": "2026-09-20", Cliente: "Ana", "Valor bruto": "100,00", "Moeda": "E1" })
    await userEvent.click(screen.getByRole("button", { name: "Lançar receita" }))
    await alerta(/Escolha o plano/)
    await preencher({ "Plano": "7" })
    await userEvent.click(screen.getByRole("button", { name: "Lançar receita" }))
    await alerta(/Moeda inválida/)
    await preencher({ Moeda: "EUR", "VAT incluído": "150,00" })
    await userEvent.click(screen.getByRole("button", { name: "Lançar receita" }))
    await alerta(/VAT não pode/)
    await preencher({ "VAT incluído": "10,00", "Recebido em": "2026-10-20" })
    await userEvent.click(screen.getByRole("button", { name: "Lançar receita" }))
    await alerta(/dentro do Ciclo/)
    expect(chamou("storage:comprovantes", "upload")).toHaveLength(0)
    expect(chamou("receitas_externas", "insert")).toHaveLength(0)
  })

  it("lançar receita válida grava plano_id, perfil_id nulo e o comprovante", async () => {
    await abrir()
    await comprovante()
    await preencher({ ...base, "VAT incluído": "10,00" })
    await userEvent.click(screen.getByRole("button", { name: "Lançar receita" }))
    await waitFor(() => expect(chamou("receitas_externas", "insert")).toHaveLength(1))
    expect(chamou("storage:comprovantes", "upload")).toHaveLength(1)
    expect(chamou("receitas_externas", "insert")[0].args[0]).toMatchObject({ plano_id: 7, perfil_id: null, moeda: "EUR", bruto_centavos: 10000, vat_centavos: 1000, recebido_em: "2026-09-20" })
  })

  it("estorno de receita externa: valor acima da receita barrado; válido grava em reembolsos com a moeda da receita", async () => {
    await abrir()
    estado.respostas["reembolsos:insert"] = { data: [{ id: 1 }], error: null }
    await preencher({ "Receita estornada": "3", "Devolvido em": "2026-09-25", "Valor devolvido": "300,00" }, "Lançar estorno")
    await userEvent.click(screen.getByRole("button", { name: "Lançar estorno" }))
    await alerta(/não pode passar do valor da receita/)
    expect(chamou("reembolsos")).toHaveLength(0)
    await preencher({ "Valor devolvido": "50,00", "VAT devolvido": "5,00" }, "Lançar estorno")
    await userEvent.click(screen.getByRole("button", { name: "Lançar estorno" }))
    await waitFor(() => expect(chamou("reembolsos", "insert")).toHaveLength(1))
    expect(chamou("reembolsos", "insert")[0].args[0]).toMatchObject({ tipo: "reembolso", receita_externa_id: 3, moeda: "EUR", valor_centavos: 5000, vat_centavos: 500 })
  })

  it("conceder acesso manual chama a RPC com o plano da receita", async () => {
    await abrir()
    estado.respostas["perfis"] = { data: [{ id: "p1", nome: "Ana Exemplo" }], error: null }
    estado.respostas["rpc:conceder_acesso_manual"] = { data: 1, error: null }
    const caixa = screen.getByRole("heading", { name: "Conceder acesso por receita fora do Stripe" }).closest("section") as HTMLElement
    const q = within(caixa)
    await userEvent.type(q.getByLabelText("Nome do membro"), "Ana")
    await userEvent.click(q.getByRole("button", { name: "Procurar membro" }))
    await userEvent.selectOptions(await q.findByLabelText(/^Membro/), "p1")
    await userEvent.selectOptions(q.getByLabelText(/Receita que pagou/), "3")
    fireEvent.change(q.getByLabelText(/Acesso vale até/), { target: { value: "2026-12-31" } })
    await userEvent.click(q.getByRole("button", { name: "Conceder acesso" }))
    await waitFor(() => expect(chamou("rpc:conceder_acesso_manual")).toHaveLength(1))
    expect(chamou("rpc:conceder_acesso_manual")[0].args[0]).toEqual({ perfil: "p1", plano: 7, receita: 3, ate: "2026-12-31T23:59:00.000Z" })
  })

  it("câmbio já cadastrado: mostra atual e nova taxa e só troca depois de confirmar", async () => {
    await abrir()
    estado.respostas["cambio_bce:select"] = { data: [{ taxa: 6.1 }], error: null }
    estado.respostas["cambio_bce:update"] = { data: [{ data: "2026-09-10" }], error: null }
    await preencher({ "Data da taxa": "2026-09-10", Moeda: "BRL", "Taxa": "6.25", Fonte: "https://exemplo.invalid/bce" }, "Cadastrar taxa do BCE")
    await userEvent.click(screen.getByRole("button", { name: "Cadastrar taxa do BCE" }))
    const dialogo = await waitFor(() => { const d = document.querySelector("dialog[open]") as HTMLElement; expect(d).toBeTruthy(); return d })
    expect(dialogo.textContent).toContain("6.1")
    expect(dialogo.textContent).toContain("6.25")
    expect(chamou("cambio_bce", "update")).toHaveLength(0)
    await userEvent.click(within(dialogo).getByRole("button", { name: "Trocar taxa", hidden: true }))
    await waitFor(() => expect(chamou("cambio_bce", "update")).toHaveLength(1))
    expect(chamou("cambio_bce", "update")[0].args[0]).toMatchObject({ taxa: 6.25 })
  })

  it("versões: SHA de cada uma, 'Enviado' só na enviada e nome -vN só no fechado", async () => {
    const fechado = { ...REL, ciclo: { ...REL.ciclo, estado: "fechado" as const, ultima_versao: 2 } }
    estado.respostas["relatorios_ciclo"] = {
      data: [
        { versao: 2, dados: fechado, enviado_em: null, reaberto_em: null, motivo_reabertura: null, csv_sha256: "sha-dois", criado_em: "2026-10-12T00:00:00Z" },
        { versao: 1, dados: { ...fechado, csv: "v1" }, enviado_em: "2026-10-11T10:00:00Z", reaberto_em: "2026-10-11T12:00:00Z", motivo_reabertura: "erro", csv_sha256: "sha-um", criado_em: "2026-10-10T00:00:00Z" },
      ],
      error: null,
    }
    montar(<RelatorioCiclo />, "/relatorio-ciclo", "/pt/admin/relatorio-ciclo")
    await screen.findByText(/1\. Receita/)
    fireEvent.change(screen.getByLabelText(/Mês em que o Ciclo/), { target: { value: "2026-09" } })
    await screen.findByText("sha-um")
    expect(screen.getByText("sha-dois", { selector: "td code" })).toBeTruthy()
    expect(screen.getAllByRole("button", { name: "Baixar CSV congelado" })).toHaveLength(2)
    // O selo "Enviado em" do cabeçalho não aparece: a versão vigente (v2) não foi enviada.
    expect(screen.queryByText(/Enviado em/, { selector: "span" })).toBeNull()
    expect(screen.getByRole("button", { name: "Marcar como enviado" })).toBeTruthy()
  })
})

describe("Equipe", () => {
  it("o próprio papel fica travado e trocar o de outra pessoa pede confirmação", async () => {
    estado.respostas["equipe"] = { data: [{ perfil_id: "eu", papel: "super_admin", criado_em: "2026-01-01T00:00:00Z" }, { perfil_id: "p2", papel: "editor", criado_em: "2026-01-02T00:00:00Z" }], error: null }
    estado.respostas["equipe:update"] = { data: [{ perfil_id: "p2" }], error: null }
    estado.respostas["perfis"] = { data: [{ id: "eu", nome: "Eu Mesmo" }, { id: "p2", nome: "Bia Editora" }], error: null }
    montar(<Equipe />, "/equipe", "/pt/admin/equipe")
    const meu = (await screen.findByLabelText("Papel — Eu Mesmo")) as HTMLSelectElement
    expect(meu.disabled).toBe(true)
    await userEvent.selectOptions(screen.getByLabelText("Papel — Bia Editora"), "auditor")
    expect(chamou("equipe", "update")).toHaveLength(0)
    await userEvent.click(within(document.querySelector("dialog[open]") as HTMLElement).getByRole("button", { name: "Trocar papel", hidden: true }))
    await waitFor(() => expect(chamou("equipe", "update")).toHaveLength(1))
    expect(chamou("equipe", "update")[0].args[0]).toEqual({ papel: "auditor" })
  })
})

describe("Checkup (g): URL, confirmações e recusa GDPR", () => {
  it("URL que não é https absoluta é barrada no campo sem chamar o banco; https grava em redes", async () => {
    estado.respostas["edicoes"] = { data: [{ id: 1, nome: "Edição 2026" }], error: null }
    estado.respostas["categorias_premio"] = { data: [{ id: 2, nome: "Inovação", edicao_id: 1 }], error: null }
    estado.respostas["premiados:insert"] = { data: [{ id: 10 }], error: null }
    montar(<Premiado />, "/premiados/:id", "/pt/admin/premiados/novo")
    await userEvent.selectOptions(await screen.findByLabelText(/^Edição/), "1")
    await userEvent.selectOptions(screen.getByLabelText(/^Categoria/), "2")
    await userEvent.type(screen.getByLabelText(/^Nome/), "Ana Exemplo")
    await userEvent.type(screen.getByLabelText("Link da matéria"), "javascript:alert(1)")
    await userEvent.type(screen.getByLabelText("LinkedIn (link)"), "nao-e-url")
    await userEvent.type(screen.getByLabelText("Site"), "http://exemplo.invalid")
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }))
    expect(await screen.findAllByText("Digite um endereço completo começando com https://.")).toHaveLength(3)
    expect(chamou("premiados", "insert")).toHaveLength(0)
    for (const r of ["Link da matéria", "LinkedIn (link)", "Site"]) await userEvent.clear(screen.getByLabelText(r))
    await userEvent.type(screen.getByLabelText("LinkedIn (link)"), "https://exemplo.invalid/in/ana")
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }))
    await waitFor(() => expect(chamou("premiados", "insert")).toHaveLength(1))
    expect(chamou("premiados", "insert")[0].args[0]).toMatchObject({ materia_url: null, redes: { linkedin: "https://exemplo.invalid/in/ana" } })
  })

  it("Equipe: adicionar pede confirmação com nome e papel; cancelar não grava", async () => {
    estado.respostas["equipe:select"] = { data: [], error: null }
    estado.respostas["equipe:insert"] = { data: [{ perfil_id: "p3" }], error: null }
    estado.respostas["perfis"] = { data: [{ id: "p3", nome: "Caio Novo" }], error: null }
    montar(<Equipe />, "/equipe", "/pt/admin/equipe")
    await userEvent.type(await screen.findByLabelText("Nome do perfil"), "Caio")
    await userEvent.selectOptions(screen.getByLabelText("Papel"), "super_admin")
    await userEvent.click(screen.getByRole("button", { name: "Procurar" }))
    await userEvent.click(await screen.findByRole("button", { name: "Adicionar: Caio Novo" }))
    const dialogo = document.querySelector("dialog[open]") as HTMLElement
    expect(dialogo.textContent).toContain("Caio Novo: Super administrador")
    expect(chamou("equipe", "insert")).toHaveLength(0)
    await userEvent.click(within(dialogo).getByRole("button", { name: "Cancelar", hidden: true }))
    expect(chamou("equipe", "insert")).toHaveLength(0)
    await userEvent.click(screen.getByRole("button", { name: "Adicionar: Caio Novo" }))
    await userEvent.click(within(document.querySelector("dialog[open]") as HTMLElement).getByRole("button", { name: "Adicionar", hidden: true }))
    await waitFor(() => expect(chamou("equipe", "insert")).toHaveLength(1))
    expect(chamou("equipe", "insert")[0].args[0]).toEqual({ perfil_id: "p3", papel: "super_admin" })
  })

  it("Equipe: convidar por e-mail chama convidar-equipe; conta existente mostra o caminho da busca", async () => {
    estado.respostas["equipe:select"] = { data: [], error: null }
    montar(<Equipe />, "/equipe", "/pt/admin/equipe")
    await userEvent.type(await screen.findByLabelText("Nome"), "Duda Nova")
    await userEvent.type(screen.getByLabelText("E-mail"), "duda@exemplo.invalid")
    await userEvent.selectOptions(screen.getByLabelText("Papel do convidado"), "corretor")
    await userEvent.click(screen.getByRole("button", { name: "Enviar convite" }))
    await waitFor(() => expect(chamou("fn:convidar-equipe")).toHaveLength(1))
    expect(chamou("fn:convidar-equipe")[0].args[0]).toEqual({ nome: "Duda Nova", email: "duda@exemplo.invalid", papel: "corretor", idioma: "pt" })
    expect(await screen.findByText(/Convite enviado/)).toBeTruthy()
    expect((screen.getByLabelText("E-mail") as HTMLInputElement).value).toBe("")
    estado.respostas["fn:convidar-equipe"] = { data: null, error: new FunctionsHttpError(new Response(JSON.stringify({ erro: "conta_existe" }), { status: 409 })) }
    await userEvent.type(screen.getByLabelText("Nome"), "Eva")
    await userEvent.type(screen.getByLabelText("E-mail"), "eva@exemplo.invalid")
    await userEvent.click(screen.getByRole("button", { name: "Enviar convite" }))
    expect((await screen.findAllByRole("alert")).map((a) => a.textContent).join(" ")).toMatch(/já tem conta/)
  })

  it("Consentimento: revogar pede confirmação (perigo) avisando da despublicação; cancelar não grava", async () => {
    estado.respostas["documentos_legais"] = { data: [{ id: 1, versao: "1", idioma: "pt", vigente_desde: "2026-01-01" }], error: null }
    estado.respostas["consentimentos:select"] = { data: [{ id: 7, documento_id: 1, titular_email: "t@exemplo.invalid", titular_nome: null, aceito_em: "2026-10-01T10:00:00Z", revogado_em: null }], error: null }
    estado.respostas["consentimentos:update"] = { data: [{ id: 7 }], error: null }
    const aoMudar = vi.fn()
    montar(<ConsentimentoHof id={7} aoRegistrar={async () => {}} aoMudar={aoMudar} />, "/premiados/:id", "/pt/admin/premiados/5")
    await userEvent.click(await screen.findByRole("button", { name: "Revogar" }))
    const dialogo = document.querySelector("dialog[open]") as HTMLElement
    expect(dialogo.textContent).toMatch(/publicação do premiado no Hall of Fame será desfeita/)
    await userEvent.click(within(dialogo).getByRole("button", { name: "Cancelar", hidden: true }))
    expect(chamou("consentimentos", "update")).toHaveLength(0)
    await userEvent.click(screen.getByRole("button", { name: "Revogar" }))
    await userEvent.click(within(document.querySelector("dialog[open]") as HTMLElement).getByRole("button", { name: "Revogar", hidden: true }))
    await waitFor(() => expect(chamou("consentimentos", "update")).toHaveLength(1))
    expect(aoMudar).toHaveBeenCalled()
  })

  it("Pedidos: recusar sem observação é barrado no campo; recusado não oferece 'Marcar como atendido'", async () => {
    estado.respostas["pedidos_gdpr:select"] = { data: [{ id: 1, email: "x@exemplo.invalid", tipo: "exclusao", status: "recebido", prazo_em: "2026-11-20", criado_em: "2026-10-20T10:00:00Z", observacao: null }], error: null }
    estado.respostas["pedidos_gdpr:update"] = { data: [{ id: 1 }], error: null }
    montar(<PedidosDeDados />, "/pedidos-de-dados", "/pt/admin/pedidos-de-dados")
    await userEvent.selectOptions(await screen.findByLabelText("Situação"), "recusado")
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }))
    expect(screen.getByText(/Escreva o motivo da recusa/)).toBeTruthy()
    expect(screen.getByLabelText("Observação").getAttribute("aria-invalid")).toBe("true")
    expect(chamou("pedidos_gdpr", "update")).toHaveLength(0)
    await userEvent.type(screen.getByLabelText("Observação"), "Titular não confirmou a identidade")
    expect(screen.queryByText(/Escreva o motivo da recusa/)).toBeNull() // o erro some ao digitar o motivo
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }))
    await waitFor(() => expect(chamou("pedidos_gdpr", "update")).toHaveLength(1))
    expect(chamou("pedidos_gdpr", "update")[0].args[0]).toEqual({ status: "recusado", observacao: "Titular não confirmou a identidade" })
    cleanup()
    estado.respostas["pedidos_gdpr:select"] = { data: [{ id: 2, email: "y@exemplo.invalid", tipo: "exportacao", status: "recusado", prazo_em: "2026-11-20", criado_em: "2026-10-20T10:00:00Z", observacao: "Sem identidade" }], error: null }
    montar(<PedidosDeDados />, "/pedidos-de-dados", "/pt/admin/pedidos-de-dados")
    await screen.findByText("y@exemplo.invalid")
    expect(screen.queryByRole("button", { name: "Marcar como atendido" })).toBeNull()
    // nem pelo seletor: recusado não vira concluído
    expect(screen.queryByRole("option", { name: "Concluído" })).toBeNull()
  })
})
