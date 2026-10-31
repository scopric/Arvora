import { cleanup, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../../../lib/supabase", async () => ({ supabase: (await import("./mockSupabase")).supabase }))
vi.mock("../../../lib/sessao", () => ({ useAuth: () => ({ sessao: { user: { id: "eu" } }, carregando: false }), sair: vi.fn() }))

import { simularDialog } from "../../../testeUtil"
import type { Relatorio } from "../lib/relatorio"
import { AulaForm } from "../telas/AulaForm"
import { Correcao } from "../telas/Correcao"
import { Empresas } from "../telas/Empresas"
import { Equipe } from "../telas/Equipe"
import { Membros } from "../telas/Membros"
import { Moderacao } from "../telas/Moderacao"
import { PedidosDeDados } from "../telas/PedidosDeDados"
import { RelatorioCiclo } from "../telas/RelatorioCiclo"
import { Temas } from "../telas/Temas"
import { VisaoGeral } from "../telas/VisaoGeral"
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

// Números conhecidos (centavos de EUR). Conferência: 125000 - 14500 = 110500.
const REL: Relatorio = {
  ciclo: { inicio: "2026-09-10", fim: "2026-10-09", estado: "rascunho", ultima_versao: null },
  cambio: { data_referencia: "2026-10-09", taxas: [{ moeda: "BRL", taxa: 6.25, data: "2026-10-09", fonte_url: "https://exemplo.invalid/bce" }] },
  receita: { stripe: 100000, externa: 25000, bruta: 125000 },
  deducoes: { vat: 10000, estornos: 5000, estornos_vat: 500, total: 14500 },
  receita_base: 110500,
  clientes_ativos: { quantidade: 42, lista: [{ chave: "cliente-1", origem: "assinatura" }] },
  ia: { avulsa: 3000, rateio: 2000, total: 5000, por_nivel: [{ nivel: "grupo", receita_liquida: 50000, horas_ia: 2, horas_total: 10, rateio: 2000 }] },
  faixa: { faixa: 1, limites: [100, 500], percentual: null, valor: null },
  pendencias: [{ tipo: "faixa_percentuais_indefinidos" }],
  linhas: [
    { fonte: "stripe", ref_id: 1, data: "2026-09-15", conta_ou_origem: "acct_x", cliente: "a@exemplo.invalid", moeda: "EUR", bruto: 100000, vat: 10000, taxa: 1, bruto_eur: 100000, vat_eur: 10000, referencia: "in_1" },
    { fonte: "externa", ref_id: 7, data: "2026-09-20", conta_ou_origem: "pix", cliente: "Cliente Pix", moeda: "EUR", bruto: 25000, vat: 0, taxa: 1, bruto_eur: 25000, vat_eur: 0, referencia: "2026/comp.pdf" },
  ],
  csv: "fonte;ref_id\nstripe;1",
}
const texto = () => document.body.textContent!.replace(/ /g, " ")

describe("Relatório do Ciclo", () => {
  async function abrirCiclo(ciclo: string) {
    montar(<RelatorioCiclo />, "/relatorio-ciclo", "/pt/admin/relatorio-ciclo")
    await screen.findByText(/1\. Receita/)
    await userEvent.selectOptions(screen.getByLabelText("Ciclo"), ciclo)
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
    expect(chamou("rpc:aprovar_empresa")[0].args[0]).toEqual({ empresa: 9, aprovar: true })
    await userEvent.click(screen.getByRole("button", { name: "Recusar" }))
    expect(chamou("rpc:aprovar_empresa")).toHaveLength(1)
    await userEvent.click(within(document.querySelector("dialog[open]") as HTMLElement).getByRole("button", { name: "Recusar", hidden: true }))
    await waitFor(() => expect(chamou("rpc:aprovar_empresa")).toHaveLength(2))
    expect(chamou("rpc:aprovar_empresa")[1].args[0]).toEqual({ empresa: 9, aprovar: false })
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
})
