import type { Chave } from "../i18n"
import type { Nivel } from "../lib/acesso"
import type { NomeIcone } from "./Icone"

// Evento da edição atual. PROVISÓRIO: a edição vem do banco (admin/edicoes); até lá, um slug fixo.
export const EDICAO_ATUAL = "2026"

export type Item = {
  rotulo: Chave
  rota: string
  // Nível mínimo para abrir de fato; abaixo disso o item aparece com cadeado e leva à página com a prévia (PRD §17.1).
  minimo?: Exclude<Nivel, "visitante">
  // Só para premiado (Meu Award): some para os demais.
  soPremiado?: boolean
  // Link para página pré-renderizada fora do app (carga nova em vez de <Link>).
  externo?: boolean
}
export type Grupo = { rotulo?: Chave; dourado?: boolean; itens: Item[] }

// Sidebar do membro, na ordem do PRD §17.3.1. Cadeados por nível: PRD §17.3.5.
export const SIDEBAR: Grupo[] = [
  {
    itens: [
      { rotulo: "menu.inicio", rota: "/inicio" },
      { rotulo: "menu.aulas", rota: "/aulas", minimo: "grupo" },
      { rotulo: "menu.academy", rota: "/academy" },
      { rotulo: "menu.bemEstar", rota: "/bem-estar", minimo: "grupo" },
    ],
  },
  {
    rotulo: "menu.awards",
    dourado: true,
    itens: [
      { rotulo: "menu.hallOfFame", rota: "/hall-of-fame", externo: true },
      { rotulo: "menu.biblioteca", rota: "/biblioteca" },
      { rotulo: "menu.originals", rota: "/originals" },
      { rotulo: "menu.directory", rota: "/directory" },
      { rotulo: "menu.network", rota: "/network", minimo: "clube" },
      { rotulo: "menu.match", rota: "/match", minimo: "grupo" },
      { rotulo: "menu.evento", rota: `/evento/${EDICAO_ATUAL}` },
      { rotulo: "menu.meuAward", rota: "/meu-award", soPremiado: true },
    ],
  },
  {
    itens: [
      { rotulo: "menu.comunidade", rota: "/comunidade", minimo: "clube" },
      { rotulo: "menu.tarefas", rota: "/tarefas", minimo: "grupo" },
    ],
  },
]

export type Aba = { rotulo: Chave; rota: string; icone: NomeIcone }
// Bottom tab bar (PRD §17.3.2). "Mais" abre a folha e não está aqui.
export const ABAS: Aba[] = [
  { rotulo: "menu.inicio", rota: "/inicio", icone: "casa" },
  { rotulo: "menu.aprender", rota: "/aulas", icone: "aprender" },
  { rotulo: "menu.awardsAba", rota: "/awards", icone: "award" },
  { rotulo: "menu.rede", rota: "/network", icone: "rede" },
]

// Folha "Mais" (mobile) e menu do avatar (desktop).
export const MAIS: Item[] = [
  { rotulo: "menu.perfil", rota: "/perfil" },
  { rotulo: "menu.notificacoes", rota: "/notificacoes" },
  { rotulo: "menu.comunidade", rota: "/comunidade", minimo: "clube" },
  { rotulo: "menu.tarefas", rota: "/tarefas", minimo: "grupo" },
  { rotulo: "menu.configuracoes", rota: "/configuracoes" },
  { rotulo: "menu.suporte", rota: "/suporte" },
  { rotulo: "menu.meuPlano", rota: "/configuracoes/assinatura" },
]
export const AVATAR: Item[] = [
  { rotulo: "menu.perfil", rota: "/perfil" },
  { rotulo: "menu.conexoes", rota: "/conexoes" },
  { rotulo: "menu.meuAward", rota: "/meu-award", soPremiado: true },
  { rotulo: "menu.notificacoes", rota: "/notificacoes" },
  { rotulo: "menu.configuracoes", rota: "/configuracoes" },
  { rotulo: "menu.assinatura", rota: "/configuracoes/assinatura" },
  { rotulo: "menu.suporte", rota: "/suporte" },
]

export type ItemAdmin = { rotulo: Chave; rota: string }
export type GrupoAdmin = { rotulo?: Chave; itens: ItemAdmin[] }
// Menu do admin (PRD §17.3.4). Correção de tarefas não consta no desenho do menu do PRD: entrou em PESSOAS para a rota ter entrada.
export const MENU_ADMIN: GrupoAdmin[] = [
  { itens: [{ rotulo: "admin.visaoGeral", rota: "/admin" }] },
  {
    rotulo: "admin.grupo.conteudo",
    itens: [
      { rotulo: "admin.item.aulas", rota: "/admin/aulas" },
      { rotulo: "admin.item.cursos", rota: "/admin/cursos" },
      { rotulo: "admin.item.videos", rota: "/admin/videos" },
      { rotulo: "admin.item.temas", rota: "/admin/temas" },
    ],
  },
  {
    rotulo: "admin.grupo.awards",
    itens: [
      { rotulo: "admin.item.edicoes", rota: "/admin/edicoes" },
      { rotulo: "admin.item.premiados", rota: "/admin/premiados" },
      { rotulo: "admin.item.empresas", rota: "/admin/empresas" },
    ],
  },
  {
    rotulo: "admin.grupo.pessoas",
    itens: [
      { rotulo: "admin.item.membros", rota: "/admin/membros" },
      { rotulo: "admin.item.correcao", rota: "/admin/correcao" },
      { rotulo: "admin.item.moderacao", rota: "/admin/moderacao" },
      { rotulo: "admin.item.pedidosDeDados", rota: "/admin/pedidos-de-dados" },
    ],
  },
  { rotulo: "admin.grupo.financeiro", itens: [{ rotulo: "admin.item.relatorioCiclo", rota: "/admin/relatorio-ciclo" }] },
  {
    rotulo: "admin.grupo.sistema",
    itens: [
      { rotulo: "admin.item.equipe", rota: "/admin/equipe" },
      { rotulo: "admin.item.log", rota: "/admin/log" },
      { rotulo: "admin.item.ia", rota: "/admin/ia" },
      { rotulo: "admin.item.verticais", rota: "/admin/verticais" },
    ],
  },
]
