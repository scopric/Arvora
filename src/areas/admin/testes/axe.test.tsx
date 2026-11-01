import { cleanup, render, screen } from "@testing-library/react"
import axe from "axe-core"
import { MemoryRouter, Route, Routes } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../../../lib/supabase", async () => ({ supabase: (await import("./mockSupabase")).supabase }))
vi.mock("../../../lib/sessao", () => ({ useAuth: () => ({ sessao: { user: { id: "eu" } }, carregando: false }), sair: vi.fn() }))

import { AcessoContext } from "../../../lib/acesso"
import { simularDialog } from "../../../testeUtil"
import { rotasAdmin } from "../rotas"
import { adminEn } from "../../../i18n/areas/admin.en"
import { adminPt } from "../../../i18n/areas/admin.pt"
import { REL } from "./fixtures"
import { estado, reiniciar } from "./mockSupabase"

simularDialog()
let erros: unknown[][] = []
beforeEach(() => {
  reiniciar()
  erros = []
  vi.spyOn(console, "error").mockImplementation((...a) => { erros.push(a) })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

async function violacoes() {
  const r = await axe.run(document.body, { rules: { "color-contrast": { enabled: false } } })
  return r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target).join(", ")}`)
}

const rotas = ["", "/aulas", "/aulas/nova", "/aulas/3", "/cursos", "/cursos/1", "/verticais", "/premiados", "/premiados/novo", "/premiados/4", "/edicoes", "/edicoes/nova", "/edicoes/2",
  "/empresas", "/videos", "/temas", "/moderacao", "/correcao", "/membros", "/membros/p1", "/pedidos-de-dados", "/relatorio-ciclo", "/equipe", "/log", "/ia"]

// Dados mínimos em FORMA DE LISTA para toda tabela (o mock devolve o 1º item quando a tela pede maybeSingle). Assim cada tela monta com linhas
// de verdade, e o teste falha se alguma delas cair na tela de erro ou lançar erro no console (antes isso passava calado).
function dados() {
  const aula = { id: 3, modulo_id: null, vertical_id: 1, tipo: "ao_vivo", titulo: "Aula", slug: "aula", descricao: null, nivel_minimo: "grupo", ordem: 0, inicio_em: "2026-11-05T19:00:00Z", duracao_min: 45, trailer_video_id: null, agendada_em: null, materiais_publicados_em: null }
  const lista = (data: unknown[], count = data.length) => ({ data, count, error: null })
  const r = estado.respostas
  r["aulas"] = lista([aula])
  r["rpc:video_da_aula"] = { data: "v1", error: null }
  r["cursos"] = lista([{ id: 1, vertical_id: 1, titulo: "Curso", slug: "curso", descricao: null, capa_path: null, nivel_minimo: "grupo", ordem: 0, publicado_em: null }])
  r["modulos"] = lista([{ id: 1, curso_id: 1, titulo: "Módulo", ordem: 1 }])
  r["verticais"] = lista([{ id: 1, nome: "Vendas", slug: "vendas", ordem: 1 }])
  r["setores"] = lista([{ id: 1, nome: "Varejo", ordem: 1 }])
  r["temas"] = lista([{ id: 1, nome: "Liderança", nome_en: null, slug: "lideranca", ordem: 1 }])
  r["edicoes"] = lista([{ id: 2, slug: "e", nome: "Edição", ano: 2026, pais: "IE", cidade: "Dublin", descricao: null, durante_inicio: "2026-11-05T19:00:00Z", durante_fim: "2026-11-06T19:00:00Z", transmissao_url: null, gravacao_video_id: null, publicada_em: null }])
  r["categorias"] = lista([{ id: 1, edicao_id: 2, nome: "Empreendedor", slug: "empreendedor", ordem: 1 }])
  r["premiados"] = lista([{ id: 4, edicao_id: 2, categoria_id: 1, empresa_id: null, perfil_id: null, nome: "Premiada", slug: "p", foto_path: null, historia: null, video_entrevista_id: null, video_premiacao_id: null, materia_url: null, redes: {}, consentimento_id: null, alteracao_em: null, publicado_em: null }])
  r["rpc:premiado_privado"] = { data: { convite_email: null, alteracao_pendente: { historia: "Nova história" } }, error: null }
  r["indicados"] = lista([])
  r["perfis"] = lista([{ id: "p1", nome: "Ana", empresa_nome: null, cidade: null, pais: null, bio: null, visibilidade: "membros", suspenso_em: null, criado_em: "2026-01-01T00:00:00Z" }])
  r["rpc:empresas_equipe"] = { data: [{ id: 9, nome: "Padaria", cidade: "Dublin", pais: "IE", site: null, descricao: "Pães", setor_id: 1, status: "pendente", criado_em: "2026-10-01T00:00:00Z" }], error: null }
  r["empresas"] = lista([{ id: 9, nome: "Padaria", slug: "padaria", setor_id: 1, cidade: "Dublin", pais: "IE", site: null, logo_path: null, descricao: null, status: "pendente" }])
  r["videos"] = lista([{ id: 1, titulo: "Vídeo", tipo: "talk", slug: "v", nivel_minimo: "clube", publicado_em: null }])
  r["rpc:video_do_video"] = { data: "v1", error: null }
  r["denuncias"] = lista([{ id: 5, motivo: "Spam", texto: null, criado_em: "2026-10-30T10:00:00Z", perfil_denunciado_id: null, post_id: 8, comentario_id: null, empresa_id: null, conexao_id: null }])
  r["posts"] = lista([{ id: 8, corpo: "Compre", autor_id: "p1", oculto_em: null }])
  r["entregas"] = lista([{ id: 5, exercicio_id: 2, perfil_id: "p1", texto: "Resposta", arquivo_path: null, enviada_em: "2026-10-25T10:00:00Z" }])
  r["exercicios"] = lista([{ id: 2, aula_id: 3, ordem: 1, enunciado_md: "Descreva", prazo_dias: 7, aceita_arquivo: false }])
  r["materiais_aula"] = lista([{ id: 1, tipo: "resumo", conteudo_md: "x", arquivo_path: null, status: "rascunho" }])
  r["transmissoes"] = lista([])
  r["assinaturas"] = lista([{ id: 1, perfil_id: "p1", plano_id: 1, status: "active", periodo_inicio: "2026-01-01T00:00:00Z", periodo_fim: "2027-01-01T00:00:00Z", cancela_no_fim: false, origem: "stripe" }])
  r["planos"] = lista([{ id: 1, nome: "Grupo", nivel: "grupo" }])
  r["clientes_stripe"] = lista([])
  r["rpc:email_do_membro"] = { data: "ana@exemplo.invalid", error: null }
  r["pedidos_gdpr"] = lista([{ id: 1, email: "x@exemplo.invalid", tipo: "exclusao", status: "recebido", prazo_em: "2026-11-20", observacao: null }])
  r["equipe"] = lista([{ perfil_id: "eu", papel: "super_admin", criado_em: "2026-01-01T00:00:00Z" }])
  r["log_admin"] = lista([{ id: 1, ator_id: "eu", acao: "UPDATE", tabela: "equipe", alvo_id: "1", antes: { papel: "editor" }, depois: { papel: "auditor" }, criado_em: "2026-10-30T10:00:00Z" }])
  r["relatorios_ciclo"] = lista([])
  r["receitas_externas"] = lista([{ id: 3, cliente_nome: "Cliente Pix", plano_id: 1, perfil_id: null, moeda: "EUR", bruto_centavos: 25000, recebido_em: "2026-09-20" }])
  r["rpc:relatorio_ciclo"] = { data: REL, error: null }
  r["documentos_legais"] = lista([])
  r["consentimentos"] = lista([])
}

describe("acessibilidade das telas do admin (axe)", () => {
  it.each(["pt", "en"].flatMap((l) => rotas.map((r) => [l, r] as const)))("/%s/admin%s sem violações", async (lang, rota) => {
    dados()
    render(
      <AcessoContext value={{ carregando: false, erro: false, nivel: "grupo", premiado: false, equipe: true, papel: "super_admin", recarregar: () => {} }}>
        <MemoryRouter initialEntries={[`/${lang}/admin${rota}`]}>
          <main><Routes><Route path="/:lang/admin">{rotasAdmin()}</Route></Routes></main>
        </MemoryRouter>
      </AcessoContext>,
    )
    await screen.findByRole("heading", { level: 1 })
    await new Promise((r) => setTimeout(r, 60))
    // A tela tem de ter carregado de verdade: sem o aviso de erro de carga e sem erro no console.
    expect(document.body.textContent).not.toContain(adminPt["admin.erro.carregar"])
    expect(document.body.textContent).not.toContain(adminEn["admin.erro.carregar"])
    expect(document.querySelector('[aria-busy="true"]')).toBeNull()
    expect(erros).toEqual([])
    expect(await violacoes()).toEqual([])
  })
})
