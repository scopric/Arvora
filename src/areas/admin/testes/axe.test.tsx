import { cleanup, render, screen } from "@testing-library/react"
import axe from "axe-core"
import { MemoryRouter, Route, Routes } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../../../lib/supabase", async () => ({ supabase: (await import("./mockSupabase")).supabase }))
vi.mock("../../../lib/sessao", () => ({ useAuth: () => ({ sessao: { user: { id: "eu" } }, carregando: false }), sair: vi.fn() }))

import { AcessoContext } from "../../../lib/acesso"
import { simularDialog } from "../../../testeUtil"
import { rotasAdmin } from "../rotas"
import { estado, reiniciar } from "./mockSupabase"

simularDialog()
beforeEach(reiniciar)
afterEach(cleanup)

async function violacoes() {
  const r = await axe.run(document.body, { rules: { "color-contrast": { enabled: false } } })
  return r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target).join(", ")}`)
}

const rotas = ["", "/aulas", "/aulas/nova", "/aulas/3", "/cursos", "/cursos/1", "/verticais", "/premiados", "/premiados/novo", "/premiados/4", "/edicoes", "/edicoes/nova", "/edicoes/2",
  "/empresas", "/videos", "/temas", "/moderacao", "/correcao", "/membros", "/membros/p1", "/pedidos-de-dados", "/relatorio-ciclo", "/equipe", "/log", "/ia"]

// Com dados mínimos para as telas que fazem `exigir(maybeSingle)`.
function dados() {
  const aula = { id: 3, modulo_id: null, vertical_id: 1, tipo: "ao_vivo", titulo: "Aula", slug: "aula", descricao: null, nivel_minimo: "grupo", ordem: 0, inicio_em: "2026-11-05T19:00:00Z", duracao_min: 45, trailer_video_id: null, agendada_em: null, materiais_publicados_em: null }
  estado.respostas["aulas"] = { data: aula, error: null }
  estado.respostas["rpc:video_da_aula"] = { data: "v1", error: null }
  estado.respostas["cursos"] = { data: { id: 1, vertical_id: 1, titulo: "Curso", slug: "curso", descricao: null, capa_path: null, nivel_minimo: "grupo", ordem: 0, publicado_em: null }, error: null }
  estado.respostas["edicoes"] = { data: { id: 2, slug: "e", nome: "Edição", ano: 2026, pais: "IE", cidade: "Dublin", descricao: null, durante_inicio: "2026-11-05T19:00:00Z", durante_fim: "2026-11-06T19:00:00Z", transmissao_url: null, gravacao_video_id: null, publicada_em: null }, error: null }
  estado.respostas["premiados"] = { data: { id: 4, edicao_id: 2, categoria_id: 1, empresa_id: null, perfil_id: null, nome: "Premiada", slug: "p", foto_path: null, historia: null, video_entrevista_id: null, video_premiacao_id: null, materia_url: null, redes: {}, consentimento_id: null, alteracao_em: null, publicado_em: null }, error: null }
  estado.respostas["rpc:premiado_privado"] = { data: { convite_email: null, alteracao_pendente: { historia: "Nova história" } }, error: null }
  estado.respostas["perfis"] = { data: { id: "p1", nome: "Ana", empresa_nome: null, cidade: null, pais: null, bio: null, visibilidade: "membros", suspenso_em: null, criado_em: "2026-01-01T00:00:00Z" }, error: null }
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
    await new Promise((r) => setTimeout(r, 30))
    expect(await violacoes()).toEqual([])
  })
})
